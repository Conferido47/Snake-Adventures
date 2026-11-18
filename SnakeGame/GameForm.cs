using System.Drawing.Drawing2D;

namespace SnakeGame;

public sealed class GameForm : Form
{
    private const int CellSize = 20;
    private const int Columns = 30;
    private const int Rows = 22;
    private const int HeaderHeight = 52;
    private const int BoardWidth = Columns * CellSize;
    private const int BoardHeight = Rows * CellSize;
    private const int StartingGameTickMilliseconds = 95;
    private const int MinimumGameTickMilliseconds = 70;
    private const int GameTickStepMilliseconds = 5;
    private const int StartingWrenMoveEveryTicks = 3;
    private const int FastWrenMoveEveryTicks = 2;
    private const int WrenMinimumSpawnDistance = 10;
    private const int NormalFoodsPerPhantomFruit = 5;
    private const int StartingPowerDurationMilliseconds = 5000;
    private const int MinimumPowerDurationMilliseconds = 3000;
    private const int PowerDurationStepMilliseconds = 500;
    private const int PhantomFruitScore = 25;
    private const int WrenDefeatScore = 50;
    private const int BossSize = 3;
    private const int BossScoreInterval = 500;
    private const int StartingBossMoveEveryTicks = 8;
    private const int MinimumBossMoveEveryTicks = 4;
    private const int BossArenaMargin = 3;
    private const int BossSpawnClearance = 2;
    private const int BossIntroMilliseconds = 1500;
    private const int StartingBossConstrictDurationMilliseconds = 5000;
    private const int MaximumBossConstrictDurationMilliseconds = 8000;
    private const int BossConstrictStepMilliseconds = 500;
    private const int BossDefeatBannerMilliseconds = 1500;
    private const int BossDefeatScore = 250;
    private const int LevelUpBannerMilliseconds = 1500;
    private const int SlashUnlockLevel = 5;
    private const int StartingBossSlashIntervalMilliseconds = 2000;
    private const int MinimumBossSlashIntervalMilliseconds = 1200;
    private const int BossSlashIntervalStepMilliseconds = 200;
    private const int SlashWarningMilliseconds = 450;
    private const int SlashMoveEveryTicks = 3;
    private const int MaximumBossSlashes = 4;
    private const int FullLifeBonusScore = 50;
    private const int ExtraLifeLeadScore = 200;
    private const int ExtraLifeNoticeMilliseconds = 1500;
    private const int RecoveryInvulnerabilityMilliseconds = 2000;
    private const int StoryIntroMilliseconds = 2400;

    private readonly System.Windows.Forms.Timer _gameTimer = new();
    private readonly List<Point> _snake = new();
    private readonly List<SwordSlash> _bossSlashes = new();
    private readonly AudioManager _audio = new();
    private readonly Random _random = new();
    private readonly StoryProgressStore _storyProgressStore = new();
    private readonly Icon? _applicationIcon;
    private readonly Font _scoreFont = new("Segoe UI Semibold", 12f);
    private readonly Font _messageFont = new("Segoe UI Semibold", 25f);
    private readonly Font _helpFont = new("Segoe UI", 11f);

    private Point _food;
    private Point _phantomFruit;
    private Point _wren;
    private Point _bossPosition;
    private Point _slashWarningOrigin;
    private Point _slashWarningDirection;
    private Point _direction;
    private Point _nextDirection;
    private int _score;
    private int _highScore;
    private int _wrenMoveCounter;
    private int _normalFoodsEaten;
    private int _powerTimeRemainingMilliseconds;
    private int _animationTick;
    private int _nextBossScore;
    private int _bossMoveCounter;
    private int _bossConstrictTimeMilliseconds;
    private int _bossIntroTimeRemainingMilliseconds;
    private int _bossDefeatTimeRemainingMilliseconds;
    private int _levelUpTimeRemainingMilliseconds;
    private int _bossSlashTimeRemainingMilliseconds;
    private int _slashWarningTimeRemainingMilliseconds;
    private int _extraLives;
    private int _nextExtraLifeScore;
    private int _extraLifeNoticeTimeRemainingMilliseconds;
    private int _recoveryTimeRemainingMilliseconds;
    private int _storyIntroTimeRemainingMilliseconds;
    private int _level;
    private int _pendingLevel;
    private int _pauseSelectedButton;
    private int _pauseHoveredButton = -1;
    private int _resultSelectedButton;
    private int _resultHoveredButton = -1;
    private bool _paused;
    private bool _gameOver;
    private bool _won;
    private bool _phantomFruitActive;
    private bool _wrenActive;
    private bool _bossActive;
    private bool _bossEnclosed;
    private bool _storyProgressDirty;
    private string _lifeRewardNotice = string.Empty;
    private string _gameOverTitle = "Game over";
    private StoryProgress _storyProgress = new();
    private GameLaunchRequest _launchRequest = GameLaunchRequest.Endless;
    private StoryChapter? _storyChapter;
    private OpeningScreen? _openingScreen;

    private bool IsPowered => _powerTimeRemainingMilliseconds > 0;
    private bool IsRecovering => _recoveryTimeRemainingMilliseconds > 0;
    private bool IsStoryMode => _launchRequest.Mode == GameMode.Story;
    private bool IsStoryResultsVisible => IsStoryMode && _gameOver;
    private int CurrentTickMilliseconds => _gameTimer.Interval;
    private int CurrentWrenMoveEveryTicks =>
        _level >= 4 ? FastWrenMoveEveryTicks : StartingWrenMoveEveryTicks;
    private int CurrentWrenPredictionCells => _level >= 5 ? 3 : _level >= 3 ? 2 : 0;
    private int CurrentPowerDurationMilliseconds => Math.Max(
        MinimumPowerDurationMilliseconds,
        StartingPowerDurationMilliseconds - Math.Max(0, _level - 2) * PowerDurationStepMilliseconds);
    private int CurrentBossMoveEveryTicks => Math.Max(
        MinimumBossMoveEveryTicks,
        StartingBossMoveEveryTicks - (_level - 1));
    private int CurrentBossConstrictDurationMilliseconds => Math.Min(
        MaximumBossConstrictDurationMilliseconds,
        StartingBossConstrictDurationMilliseconds + (_level - 1) * BossConstrictStepMilliseconds);
    private bool BossUsesSlashes => _level >= SlashUnlockLevel;
    private int CurrentSlashMoveEveryTicks => _level >= 7 ? 2 : SlashMoveEveryTicks;
    private int CurrentBossSlashIntervalMilliseconds => Math.Max(
        MinimumBossSlashIntervalMilliseconds,
        StartingBossSlashIntervalMilliseconds -
        Math.Max(0, _level - SlashUnlockLevel) * BossSlashIntervalStepMilliseconds);

    public GameForm()
    {
        _applicationIcon = LoadApplicationIcon();
        if (_applicationIcon is not null)
        {
            Icon = _applicationIcon;
        }

        Text = "Snake Adventures";
        ClientSize = new Size(BoardWidth, HeaderHeight + BoardHeight);
        BackColor = Color.FromArgb(20, 27, 32);
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        KeyPreview = false;

        SetStyle(
            ControlStyles.AllPaintingInWmPaint |
            ControlStyles.OptimizedDoubleBuffer |
            ControlStyles.UserPaint,
            true);

        _gameTimer.Interval = StartingGameTickMilliseconds;
        _gameTimer.Tick += GameTimer_Tick;
        KeyDown += GameForm_KeyDown;

        _storyProgress = _storyProgressStore.Load();
        ShowOpeningScreen();
    }

    private static Icon? LoadApplicationIcon()
    {
        using Stream? stream = typeof(GameForm).Assembly.GetManifestResourceStream(
            "SnakeGame.SnakeAdventures.ico");
        if (stream is null)
        {
            return null;
        }

        using Icon icon = new(stream);
        return (Icon)icon.Clone();
    }

    private void ShowOpeningScreen(bool openChapterSelect = false)
    {
        if (_openingScreen is not null)
        {
            return;
        }

        _gameTimer.Stop();
        PersistStoryProgress();
        KeyPreview = false;
        _audio.Resume();
        _audio.PlayMusic(MusicTrack.Menu);
        _audio.ResumeMusic();

        OpeningScreen openingScreen = new(_audio, _storyProgress, openChapterSelect);
        openingScreen.StartRequested += StartFromOpeningScreen;
        openingScreen.ExitRequested += (_, _) => Close();
        _openingScreen = openingScreen;
        Controls.Add(openingScreen);
        openingScreen.BringToFront();

        if (IsHandleCreated && Visible)
        {
            BeginInvoke(new Action(() => openingScreen.Focus()));
        }
        else
        {
            Shown += (_, _) => openingScreen.Focus();
        }
    }

    private void StartFromOpeningScreen(GameLaunchRequest request)
    {
        if (_openingScreen is null)
        {
            return;
        }

        Controls.Remove(_openingScreen);
        _openingScreen.Dispose();
        _openingScreen = null;
        _launchRequest = request;
        _storyChapter = request.Mode == GameMode.Story
            ? StoryChapter.Get(request.ChapterNumber)
            : null;
        KeyPreview = true;
        StartGame();
        Focus();
    }

    private void StartGame()
    {
        _gameTimer.Stop();
        _audio.Resume();
        _audio.PlayMusic(MusicTrack.Adventure);
        _audio.ResumeMusic();
        _gameTimer.Interval = StartingGameTickMilliseconds;
        _snake.Clear();
        _bossSlashes.Clear();

        int startX = Columns / 2;
        int startY = Rows / 2;
        for (int i = 0; i < 4; i++)
        {
            _snake.Add(new Point(startX - i, startY));
        }

        _direction = new Point(1, 0);
        _nextDirection = _direction;
        _score = 0;
        _wrenMoveCounter = 0;
        _normalFoodsEaten = 0;
        _powerTimeRemainingMilliseconds = 0;
        _animationTick = 0;
        _nextBossScore = _storyChapter?.BossScoreTarget ?? BossScoreInterval;
        _bossMoveCounter = 0;
        _bossConstrictTimeMilliseconds = 0;
        _bossIntroTimeRemainingMilliseconds = 0;
        _bossDefeatTimeRemainingMilliseconds = 0;
        _levelUpTimeRemainingMilliseconds = 0;
        _bossSlashTimeRemainingMilliseconds = 0;
        _slashWarningTimeRemainingMilliseconds = 0;
        _extraLives = 0;
        _nextExtraLifeScore = _nextBossScore - ExtraLifeLeadScore;
        _extraLifeNoticeTimeRemainingMilliseconds = 0;
        _recoveryTimeRemainingMilliseconds = 0;
        _storyIntroTimeRemainingMilliseconds = IsStoryMode ? StoryIntroMilliseconds : 0;
        _level = 1;
        _pendingLevel = 0;
        _pauseSelectedButton = 0;
        _pauseHoveredButton = -1;
        _resultSelectedButton = 0;
        _resultHoveredButton = -1;
        Cursor = Cursors.Default;
        _paused = false;
        _gameOver = false;
        _won = false;
        _phantomFruitActive = false;
        _wrenActive = false;
        _bossActive = false;
        _bossEnclosed = false;
        _lifeRewardNotice = string.Empty;
        _gameOverTitle = "Game over";
        _food = new Point(-1, -1);
        _phantomFruit = new Point(-1, -1);
        _bossPosition = new Point(-BossSize, -BossSize);
        _slashWarningOrigin = Point.Empty;
        _slashWarningDirection = Point.Empty;

        _wrenActive = PlaceWren();
        if (!PlaceFood())
        {
            EndBoardClear();
            return;
        }

        _gameTimer.Start();
        Invalidate();
    }

    private void GameTimer_Tick(object? sender, EventArgs e)
    {
        _animationTick++;

        if (_storyIntroTimeRemainingMilliseconds > 0)
        {
            _storyIntroTimeRemainingMilliseconds = Math.Max(
                0,
                _storyIntroTimeRemainingMilliseconds - CurrentTickMilliseconds);
            Invalidate();
            return;
        }

        if (UpdateBossTransition())
        {
            Invalidate();
            return;
        }

        UpdateLifeTimers();
        UpdatePowerMode();

        _direction = _nextDirection;
        Point currentHead = _snake[0];
        Point newHead = WrapCell(new Point(
            currentHead.X + _direction.X,
            currentHead.Y + _direction.Y));

        bool eatingFood = newHead == _food;
        bool eatingPhantomFruit = _phantomFruitActive && newHead == _phantomFruit;
        bool growing = eatingFood || eatingPhantomFruit;

        int bodyCollisionIndex = _bossActive
            ? -1
            : FindBodyCollisionIndex(newHead, growing);
        if (bodyCollisionIndex >= 0)
        {
            bool survived = IsRecovering || HandleFatalCollision("Game over");
            if (survived)
            {
                // Cut away the collided section so normal play never phases through the body.
                _snake.RemoveRange(
                    bodyCollisionIndex,
                    _snake.Count - bodyCollisionIndex);
            }

            return;
        }

        if (_wrenActive && newHead == _wren && !HandleWrenCollision())
        {
            return;
        }

        if (_bossActive &&
            !IsRecovering &&
            BossContainsCell(_bossPosition, newHead))
        {
            HandleFatalCollision("The Hollow King struck you!");
            return;
        }

        if (!HandleSlashAt(newHead))
        {
            return;
        }

        _snake.Insert(0, newHead);

        if (eatingFood)
        {
            AddScore(10);
            _normalFoodsEaten++;

            if (!PlaceFood())
            {
                EndBoardClear();
                return;
            }

            if (_normalFoodsEaten % NormalFoodsPerPhantomFruit == 0 && !_phantomFruitActive)
            {
                PlacePhantomFruit();
            }
        }
        else if (eatingPhantomFruit)
        {
            _phantomFruitActive = false;
            _powerTimeRemainingMilliseconds = CurrentPowerDurationMilliseconds;
            AddScore(PhantomFruitScore);
            _audio.PlayCue(SoundCue.PhantomFruit);
        }
        else
        {
            _snake.RemoveAt(_snake.Count - 1);
        }

        if (_bossActive)
        {
            MoveBoss();
            if (!UpdateBossSlashes())
            {
                return;
            }

            UpdateBossConstrict();
        }
        else
        {
            if (MoveWren() && !HandleWrenCollision())
            {
                return;
            }

            TryStartBossBattle();
        }

        Invalidate();
    }

    private int FindBodyCollisionIndex(Point newHead, bool growing)
    {
        // The tail moves away when no food is eaten, so its current cell is safe.
        int segmentsToCheck = _snake.Count - (growing ? 0 : 1);
        for (int i = 0; i < segmentsToCheck; i++)
        {
            if (_snake[i] == newHead)
            {
                return i;
            }
        }

        return -1;
    }

    private bool PlaceWren()
    {
        HashSet<Point> occupiedCells = new(_snake);
        occupiedCells.Add(_food);
        if (_phantomFruitActive)
        {
            occupiedCells.Add(_phantomFruit);
        }

        List<Point> emptyCells = new();
        List<Point> distantCells = new();

        for (int y = 0; y < Rows; y++)
        {
            for (int x = 0; x < Columns; x++)
            {
                Point cell = new(x, y);
                if (occupiedCells.Contains(cell))
                {
                    continue;
                }

                emptyCells.Add(cell);
                if (WrappedDistance(cell, _snake[0]) >= WrenMinimumSpawnDistance)
                {
                    distantCells.Add(cell);
                }
            }
        }

        if (emptyCells.Count == 0)
        {
            return false;
        }

        List<Point> spawnCells = distantCells.Count > 0 ? distantCells : emptyCells;
        _wren = spawnCells[_random.Next(spawnCells.Count)];
        return true;
    }

    private bool PlaceFood()
    {
        HashSet<Point> occupiedCells = new(_snake);
        if (_wrenActive)
        {
            occupiedCells.Add(_wren);
        }

        if (_phantomFruitActive)
        {
            occupiedCells.Add(_phantomFruit);
        }

        AddBossCells(occupiedCells);

        List<Point> emptyCells = new();

        for (int y = 0; y < Rows; y++)
        {
            for (int x = 0; x < Columns; x++)
            {
                Point cell = new(x, y);
                if (!occupiedCells.Contains(cell))
                {
                    emptyCells.Add(cell);
                }
            }
        }

        if (emptyCells.Count == 0)
        {
            return false;
        }

        _food = emptyCells[_random.Next(emptyCells.Count)];
        return true;
    }

    private bool PlacePhantomFruit()
    {
        HashSet<Point> occupiedCells = new(_snake)
        {
            _food
        };

        if (_wrenActive)
        {
            occupiedCells.Add(_wren);
        }

        AddBossCells(occupiedCells);

        List<Point> emptyCells = new();
        for (int y = 0; y < Rows; y++)
        {
            for (int x = 0; x < Columns; x++)
            {
                Point cell = new(x, y);
                if (!occupiedCells.Contains(cell))
                {
                    emptyCells.Add(cell);
                }
            }
        }

        if (emptyCells.Count == 0)
        {
            return false;
        }

        _phantomFruit = emptyCells[_random.Next(emptyCells.Count)];
        _phantomFruitActive = true;
        return true;
    }

    private void UpdatePowerMode()
    {
        if (IsPowered)
        {
            _powerTimeRemainingMilliseconds = Math.Max(
                0,
                _powerTimeRemainingMilliseconds - CurrentTickMilliseconds);
        }

        if (!IsPowered &&
            !_wrenActive &&
            !_bossActive &&
            _bossDefeatTimeRemainingMilliseconds == 0 &&
            _levelUpTimeRemainingMilliseconds == 0)
        {
            _wrenActive = PlaceWren();
            _wrenMoveCounter = 0;
        }
    }

    private bool HandleWrenCollision()
    {
        if (IsPowered)
        {
            _wrenActive = false;
            _wrenMoveCounter = 0;
            AddScore(WrenDefeatScore);
            return true;
        }

        if (IsRecovering)
        {
            return true;
        }

        HandleFatalCollision("Wren caught you!");
        return false;
    }

    private void AddScore(int points)
    {
        _score += points;
        UpdateEndlessHighScore();

        while (_score >= _nextExtraLifeScore)
        {
            _nextExtraLifeScore += BossScoreInterval;

            if (_extraLives == 0)
            {
                _extraLives = 1;
                _lifeRewardNotice = "EXTRA LIFE  +1";
            }
            else
            {
                _score += FullLifeBonusScore;
                UpdateEndlessHighScore();
                _lifeRewardNotice = $"LIFE FULL  +{FullLifeBonusScore}";
            }

            _extraLifeNoticeTimeRemainingMilliseconds = ExtraLifeNoticeMilliseconds;
        }
    }

    private void UpdateEndlessHighScore()
    {
        if (!IsStoryMode)
        {
            _highScore = Math.Max(_highScore, _score);
        }
    }

    private void UpdateLifeTimers()
    {
        _extraLifeNoticeTimeRemainingMilliseconds = Math.Max(
            0,
            _extraLifeNoticeTimeRemainingMilliseconds - CurrentTickMilliseconds);
        _recoveryTimeRemainingMilliseconds = Math.Max(
            0,
            _recoveryTimeRemainingMilliseconds - CurrentTickMilliseconds);
    }

    private bool HandleFatalCollision(string title)
    {
        if (_extraLives == 0)
        {
            EndGame(won: false, title: title);
            return false;
        }

        _extraLives--;
        _recoveryTimeRemainingMilliseconds = RecoveryInvulnerabilityMilliseconds;
        _extraLifeNoticeTimeRemainingMilliseconds = 0;
        _lifeRewardNotice = string.Empty;
        _audio.PlayCue(SoundCue.LifeLost);
        Invalidate();
        return true;
    }

    private bool UpdateBossTransition()
    {
        if (_bossIntroTimeRemainingMilliseconds > 0)
        {
            _bossIntroTimeRemainingMilliseconds = Math.Max(
                0,
                _bossIntroTimeRemainingMilliseconds - CurrentTickMilliseconds);
            return true;
        }

        if (_bossDefeatTimeRemainingMilliseconds > 0)
        {
            _bossDefeatTimeRemainingMilliseconds = Math.Max(
                0,
                _bossDefeatTimeRemainingMilliseconds - CurrentTickMilliseconds);

            if (_bossDefeatTimeRemainingMilliseconds == 0)
            {
                if (IsStoryMode)
                {
                    CompleteStoryChapter();
                }
                else
                {
                    _levelUpTimeRemainingMilliseconds = LevelUpBannerMilliseconds;
                    _audio.PlayCue(SoundCue.LevelUp);
                }
            }

            return true;
        }

        if (_levelUpTimeRemainingMilliseconds > 0)
        {
            _levelUpTimeRemainingMilliseconds = Math.Max(
                0,
                _levelUpTimeRemainingMilliseconds - CurrentTickMilliseconds);

            if (_levelUpTimeRemainingMilliseconds == 0)
            {
                ApplyPendingLevel();
                _wrenActive = PlaceWren();
                _wrenMoveCounter = 0;
                _audio.PlayMusic(MusicTrack.Adventure);
            }

            return true;
        }

        return false;
    }

    private bool TryStartBossBattle()
    {
        if (_score < _nextBossScore ||
            _bossActive ||
            _bossDefeatTimeRemainingMilliseconds > 0 ||
            !TryPlaceBoss())
        {
            return false;
        }

        _bossActive = true;
        _bossEnclosed = false;
        _bossMoveCounter = 0;
        _bossConstrictTimeMilliseconds = 0;
        _bossIntroTimeRemainingMilliseconds = BossIntroMilliseconds;
        _bossSlashTimeRemainingMilliseconds = CurrentBossSlashIntervalMilliseconds;
        _slashWarningTimeRemainingMilliseconds = 0;
        _bossSlashes.Clear();
        _wrenActive = false;
        _wrenMoveCounter = 0;
        _audio.PlayMusic(MusicTrack.Boss);
        return true;
    }

    private bool TryPlaceBoss()
    {
        HashSet<Point> occupiedCells = new(_snake)
        {
            _food
        };

        if (_phantomFruitActive)
        {
            occupiedCells.Add(_phantomFruit);
        }

        if (_wrenActive)
        {
            occupiedCells.Add(_wren);
        }

        List<Point> bestPositions = new();
        int greatestDistance = int.MinValue;

        for (int y = BossArenaMargin; y <= Rows - BossSize - BossArenaMargin; y++)
        {
            for (int x = BossArenaMargin; x <= Columns - BossSize - BossArenaMargin; x++)
            {
                Point position = new(x, y);
                if (!BossAreaIsClear(position, occupiedCells, BossSpawnClearance))
                {
                    continue;
                }

                Point bossCenter = new(x + BossSize / 2, y + BossSize / 2);
                int distance = WrappedDistance(bossCenter, _snake[0]);
                if (distance > greatestDistance)
                {
                    greatestDistance = distance;
                    bestPositions.Clear();
                    bestPositions.Add(position);
                }
                else if (distance == greatestDistance)
                {
                    bestPositions.Add(position);
                }
            }
        }

        if (bestPositions.Count == 0)
        {
            return false;
        }

        _bossPosition = bestPositions[_random.Next(bestPositions.Count)];
        return true;
    }

    private static bool BossAreaIsClear(
        Point position,
        HashSet<Point> occupiedCells,
        int clearance)
    {
        for (int y = position.Y - clearance;
             y < position.Y + BossSize + clearance;
             y++)
        {
            for (int x = position.X - clearance;
                 x < position.X + BossSize + clearance;
                 x++)
            {
                if (occupiedCells.Contains(new Point(x, y)))
                {
                    return false;
                }
            }
        }

        return true;
    }

    private void MoveBoss()
    {
        if (_slashWarningTimeRemainingMilliseconds > 0)
        {
            return;
        }

        _bossMoveCounter++;
        if (_bossMoveCounter < CurrentBossMoveEveryTicks)
        {
            return;
        }

        _bossMoveCounter = 0;
        Point[] possibleMoves =
        {
            new(_bossPosition.X + 1, _bossPosition.Y),
            new(_bossPosition.X - 1, _bossPosition.Y),
            new(_bossPosition.X, _bossPosition.Y + 1),
            new(_bossPosition.X, _bossPosition.Y - 1)
        };

        List<Point> bestMoves = new();
        int shortestDistance = int.MaxValue;

        foreach (Point move in possibleMoves)
        {
            if (!CanBossMoveTo(move))
            {
                continue;
            }

            Point center = new(move.X + BossSize / 2, move.Y + BossSize / 2);
            int distance = Math.Abs(center.X - _snake[0].X) +
                           Math.Abs(center.Y - _snake[0].Y);
            if (distance < shortestDistance)
            {
                shortestDistance = distance;
                bestMoves.Clear();
                bestMoves.Add(move);
            }
            else if (distance == shortestDistance)
            {
                bestMoves.Add(move);
            }
        }

        if (bestMoves.Count > 0)
        {
            _bossPosition = bestMoves[_random.Next(bestMoves.Count)];
        }
    }

    private bool HandleSlashAt(Point cell)
    {
        int removedCount = _bossSlashes.RemoveAll(slash => slash.Position == cell);
        if (removedCount == 0 || IsRecovering)
        {
            return true;
        }

        HandleFatalCollision("The Hollow King's slash hit you!");
        return false;
    }

    private bool UpdateBossSlashes()
    {
        if (!BossUsesSlashes)
        {
            _bossSlashes.Clear();
            _slashWarningTimeRemainingMilliseconds = 0;
            return true;
        }

        if (_slashWarningTimeRemainingMilliseconds > 0)
        {
            _slashWarningTimeRemainingMilliseconds = Math.Max(
                0,
                _slashWarningTimeRemainingMilliseconds - CurrentTickMilliseconds);

            if (_slashWarningTimeRemainingMilliseconds == 0)
            {
                LaunchBossSlash();
            }
        }
        else
        {
            _bossSlashTimeRemainingMilliseconds -= CurrentTickMilliseconds;
            if (_bossSlashTimeRemainingMilliseconds <= 0)
            {
                BeginBossSlashWarning();
            }
        }

        for (int i = _bossSlashes.Count - 1; i >= 0; i--)
        {
            SwordSlash slash = _bossSlashes[i];
            slash.MoveCounter++;

            if (slash.MoveCounter >= CurrentSlashMoveEveryTicks)
            {
                slash.MoveCounter = 0;
                slash.Position = new Point(
                    slash.Position.X + slash.Direction.X,
                    slash.Position.Y + slash.Direction.Y);
            }

            if (slash.Position.X < 0 ||
                slash.Position.X >= Columns ||
                slash.Position.Y < 0 ||
                slash.Position.Y >= Rows)
            {
                _bossSlashes.RemoveAt(i);
                continue;
            }

            if (slash.Position != _snake[0])
            {
                continue;
            }

            _bossSlashes.RemoveAt(i);
            if (IsRecovering)
            {
                continue;
            }

            if (!HandleFatalCollision("The Hollow King's slash hit you!"))
            {
                return false;
            }
        }

        return true;
    }

    private void BeginBossSlashWarning()
    {
        Point bossCenter = new(
            _bossPosition.X + BossSize / 2,
            _bossPosition.Y + BossSize / 2);
        int horizontalDistance = _snake[0].X - bossCenter.X;
        int verticalDistance = _snake[0].Y - bossCenter.Y;

        if (horizontalDistance == 0 && verticalDistance == 0)
        {
            horizontalDistance = _direction.X;
            verticalDistance = _direction.Y;
        }

        if (Math.Abs(horizontalDistance) >= Math.Abs(verticalDistance))
        {
            _slashWarningDirection = new Point(Math.Sign(horizontalDistance) is 0
                ? 1
                : Math.Sign(horizontalDistance), 0);
            _slashWarningOrigin = new Point(
                _slashWarningDirection.X > 0 ? _bossPosition.X + BossSize : _bossPosition.X - 1,
                bossCenter.Y);
        }
        else
        {
            _slashWarningDirection = new Point(0, Math.Sign(verticalDistance) is 0
                ? 1
                : Math.Sign(verticalDistance));
            _slashWarningOrigin = new Point(
                bossCenter.X,
                _slashWarningDirection.Y > 0 ? _bossPosition.Y + BossSize : _bossPosition.Y - 1);
        }

        _slashWarningTimeRemainingMilliseconds = SlashWarningMilliseconds;
        _audio.PlayCue(SoundCue.SlashWarning);
    }

    private void LaunchBossSlash()
    {
        if (IsUnitCardinal(_slashWarningDirection) &&
            _bossSlashes.Count < MaximumBossSlashes)
        {
            _bossSlashes.Add(new SwordSlash(_slashWarningOrigin, _slashWarningDirection));
        }

        _bossSlashTimeRemainingMilliseconds = CurrentBossSlashIntervalMilliseconds;
        _audio.PlayCue(SoundCue.SwordSlash);
    }

    private bool CanBossMoveTo(Point position)
    {
        if (position.X < BossArenaMargin ||
            position.Y < BossArenaMargin ||
            position.X > Columns - BossSize - BossArenaMargin ||
            position.Y > Rows - BossSize - BossArenaMargin)
        {
            return false;
        }

        for (int y = position.Y; y < position.Y + BossSize; y++)
        {
            for (int x = position.X; x < position.X + BossSize; x++)
            {
                Point cell = new(x, y);
                bool blockedByFruit = cell == _food ||
                                      (_phantomFruitActive && cell == _phantomFruit);
                if (blockedByFruit || _snake.Contains(cell))
                {
                    return false;
                }
            }
        }

        return true;
    }

    private void UpdateBossConstrict()
    {
        _bossEnclosed = IsBossEnclosed();
        if (!_bossEnclosed)
        {
            return;
        }

        _bossConstrictTimeMilliseconds = Math.Min(
            CurrentBossConstrictDurationMilliseconds,
            _bossConstrictTimeMilliseconds + CurrentTickMilliseconds);

        if (_bossConstrictTimeMilliseconds >= CurrentBossConstrictDurationMilliseconds)
        {
            DefeatBoss();
        }
    }

    private bool IsBossEnclosed()
    {
        HashSet<Point> blockedCells = new(_snake);
        bool[,] visited = new bool[Columns, Rows];
        Queue<Point> cellsToVisit = new();
        Point start = new(
            _bossPosition.X + BossSize / 2,
            _bossPosition.Y + BossSize / 2);

        visited[start.X, start.Y] = true;
        cellsToVisit.Enqueue(start);

        while (cellsToVisit.Count > 0)
        {
            Point cell = cellsToVisit.Dequeue();
            if (cell.X == 0 ||
                cell.X == Columns - 1 ||
                cell.Y == 0 ||
                cell.Y == Rows - 1)
            {
                return false;
            }

            TryVisit(cell.X + 1, cell.Y);
            TryVisit(cell.X - 1, cell.Y);
            TryVisit(cell.X, cell.Y + 1);
            TryVisit(cell.X, cell.Y - 1);
        }

        return true;

        void TryVisit(int x, int y)
        {
            if (x < 0 || x >= Columns || y < 0 || y >= Rows || visited[x, y])
            {
                return;
            }

            Point nextCell = new(x, y);
            if (blockedCells.Contains(nextCell))
            {
                return;
            }

            visited[x, y] = true;
            cellsToVisit.Enqueue(nextCell);
        }
    }

    private void DefeatBoss()
    {
        _bossActive = false;
        _bossEnclosed = false;
        _bossDefeatTimeRemainingMilliseconds = BossDefeatBannerMilliseconds;
        _pendingLevel = IsStoryMode ? 0 : _level + 1;
        _bossSlashes.Clear();
        _slashWarningTimeRemainingMilliseconds = 0;
        RemoveOverlappingTail();
        AddScore(BossDefeatScore);
        _audio.PlayMusic(MusicTrack.None);
        _audio.PlayCue(SoundCue.BossDefeated);

        if (IsStoryMode)
        {
            MarkStoryChapterComplete();
        }

        if (!IsStoryMode)
        {
            _nextBossScore += BossScoreInterval;
            _nextExtraLifeScore = Math.Max(
                _nextExtraLifeScore,
                _nextBossScore - ExtraLifeLeadScore);
        }
    }

    private void CompleteStoryChapter()
    {
        if (_storyChapter is null)
        {
            return;
        }

        PersistStoryProgress();
        EndGame(won: true, title: "CHAPTER COMPLETE");
    }

    private void MarkStoryChapterComplete()
    {
        if (_storyChapter is null)
        {
            return;
        }

        _storyProgressDirty |= _storyProgress.Complete(_storyChapter.Number);
        PersistStoryProgress();
    }

    private void PersistStoryProgress()
    {
        if (_storyProgressDirty && _storyProgressStore.Save(_storyProgress))
        {
            _storyProgressDirty = false;
        }
    }

    private void ApplyPendingLevel()
    {
        if (_pendingLevel <= _level)
        {
            return;
        }

        _level = _pendingLevel;
        _pendingLevel = 0;
        _gameTimer.Interval = Math.Max(
            MinimumGameTickMilliseconds,
            StartingGameTickMilliseconds - (_level - 1) * GameTickStepMilliseconds);
    }

    private void RemoveOverlappingTail()
    {
        HashSet<Point> occupiedCells = new();
        for (int i = 0; i < _snake.Count; i++)
        {
            if (occupiedCells.Add(_snake[i]))
            {
                continue;
            }

            _snake.RemoveRange(i, _snake.Count - i);
            return;
        }
    }

    private void AddBossCells(HashSet<Point> occupiedCells)
    {
        if (!_bossActive)
        {
            return;
        }

        for (int y = _bossPosition.Y; y < _bossPosition.Y + BossSize; y++)
        {
            for (int x = _bossPosition.X; x < _bossPosition.X + BossSize; x++)
            {
                occupiedCells.Add(new Point(x, y));
            }
        }
    }

    private static bool BossContainsCell(Point bossPosition, Point cell)
    {
        return cell.X >= bossPosition.X &&
               cell.X < bossPosition.X + BossSize &&
               cell.Y >= bossPosition.Y &&
               cell.Y < bossPosition.Y + BossSize;
    }

    private bool MoveWren()
    {
        if (!_wrenActive)
        {
            return false;
        }

        _wrenMoveCounter++;
        if (_wrenMoveCounter < CurrentWrenMoveEveryTicks)
        {
            return false;
        }

        _wrenMoveCounter = 0;
        Point snakeHead = _snake[0];
        Point target = snakeHead;
        if (!IsPowered)
        {
            for (int i = 0; i < CurrentWrenPredictionCells; i++)
            {
                target = WrapCell(new Point(
                    target.X + _direction.X,
                    target.Y + _direction.Y));
            }
        }

        Point[] possibleMoves =
        {
            WrapCell(new Point(_wren.X + 1, _wren.Y)),
            WrapCell(new Point(_wren.X - 1, _wren.Y)),
            WrapCell(new Point(_wren.X, _wren.Y + 1)),
            WrapCell(new Point(_wren.X, _wren.Y - 1))
        };

        List<Point> bestMoves = new();
        int bestDistance = IsPowered ? int.MinValue : int.MaxValue;

        foreach (Point move in possibleMoves)
        {
            bool blockedBySnake = move != snakeHead && _snake.Contains(move);
            bool blockedByFruit = move == _food ||
                                  (_phantomFruitActive && move == _phantomFruit);
            if (blockedBySnake || blockedByFruit)
            {
                continue;
            }

            int distance = WrappedDistance(move, target);
            bool isBetterMove = IsPowered
                ? distance > bestDistance
                : distance < bestDistance;

            if (isBetterMove)
            {
                bestDistance = distance;
                bestMoves.Clear();
                bestMoves.Add(move);
            }
            else if (distance == bestDistance)
            {
                bestMoves.Add(move);
            }
        }

        if (bestMoves.Count > 0)
        {
            _wren = bestMoves[_random.Next(bestMoves.Count)];
        }

        return _wren == snakeHead;
    }

    private static Point WrapCell(Point cell)
    {
        return new Point(
            (cell.X + Columns) % Columns,
            (cell.Y + Rows) % Rows);
    }

    private static int WrappedDistance(Point first, Point second)
    {
        int horizontalDistance = Math.Abs(first.X - second.X);
        int verticalDistance = Math.Abs(first.Y - second.Y);

        horizontalDistance = Math.Min(horizontalDistance, Columns - horizontalDistance);
        verticalDistance = Math.Min(verticalDistance, Rows - verticalDistance);

        return horizontalDistance + verticalDistance;
    }

    private void EndGame(bool won, string title)
    {
        if (_gameOver)
        {
            return;
        }

        _gameTimer.Stop();
        _audio.PlayMusic(MusicTrack.None);
        _audio.PlayCue(won ? SoundCue.Win : SoundCue.Lose);
        _storyIntroTimeRemainingMilliseconds = 0;
        _gameOver = true;
        _won = won;
        _gameOverTitle = title;
        _resultSelectedButton = 0;
        _resultHoveredButton = -1;
        Cursor = Cursors.Default;
        Invalidate();
    }

    private void EndBoardClear()
    {
        if (IsStoryMode)
        {
            EndGame(won: false, title: "The Hollow King still stands!");
            return;
        }

        EndGame(won: true, title: "You win!");
    }

    private void GameForm_KeyDown(object? sender, KeyEventArgs e)
    {
        if (_openingScreen is not null)
        {
            return;
        }

        if (_storyIntroTimeRemainingMilliseconds > 0 &&
            e.KeyCode is Keys.Space or Keys.Enter)
        {
            _storyIntroTimeRemainingMilliseconds = 0;
            e.Handled = true;
            Invalidate();
            return;
        }

        if (IsStoryResultsVisible)
        {
            HandleStoryResultsKey(e);
            return;
        }

        if (e.KeyCode is Keys.R || (_gameOver && e.KeyCode is Keys.Space or Keys.Enter))
        {
            StartGame();
            e.Handled = true;
            return;
        }

        if (e.KeyCode == Keys.P && !_gameOver)
        {
            if (_paused)
            {
                ResumeGame();
            }
            else
            {
                PauseGame();
            }

            e.Handled = true;
            return;
        }

        if (_paused)
        {
            HandlePauseMenuKey(e);
            return;
        }

        if (_gameOver)
        {
            return;
        }

        Point? requestedDirection = e.KeyCode switch
        {
            Keys.Up or Keys.W => new Point(0, -1),
            Keys.Down or Keys.S => new Point(0, 1),
            Keys.Left or Keys.A => new Point(-1, 0),
            Keys.Right or Keys.D => new Point(1, 0),
            _ => null
        };

        if (requestedDirection is Point direction && !IsOpposite(direction, _direction))
        {
            _nextDirection = direction;
            e.Handled = true;
        }
    }

    private void HandleStoryResultsKey(KeyEventArgs e)
    {
        if (e.KeyCode == Keys.R)
        {
            StartGame();
            e.Handled = true;
            return;
        }

        if (e.KeyCode == Keys.Escape)
        {
            ReturnToChapterSelect();
            e.Handled = true;
            return;
        }

        if (e.KeyCode is Keys.Up or Keys.Left)
        {
            SelectStoryResultButton((_resultSelectedButton + 2) % 3);
            e.Handled = true;
            return;
        }

        if (e.KeyCode is Keys.Down or Keys.Right)
        {
            SelectStoryResultButton((_resultSelectedButton + 1) % 3);
            e.Handled = true;
            return;
        }

        if (e.KeyCode is Keys.Enter or Keys.Space)
        {
            ActivateStoryResultButton(_resultSelectedButton);
            e.Handled = true;
        }
    }

    private void SelectStoryResultButton(int index)
    {
        if (_resultSelectedButton == index)
        {
            return;
        }

        _resultSelectedButton = index;
        _resultHoveredButton = -1;
        Cursor = Cursors.Default;
        _audio.PlayCue(SoundCue.MenuMove);
        Invalidate();
    }

    private void ActivateStoryResultButton(int index)
    {
        _audio.PlayCue(SoundCue.MenuMove);
        switch (index)
        {
            case 0:
                if (_won)
                {
                    ContinueStory();
                }
                else
                {
                    StartGame();
                }

                break;
            case 1:
                if (_won)
                {
                    StartGame();
                }
                else
                {
                    ReturnToChapterSelect();
                }

                break;
            case 2:
                ReturnToMainMenu();
                break;
        }
    }

    private void ContinueStory()
    {
        if (_storyChapter is not null)
        {
            StoryChapter? nextChapter = StoryChapter.Find(_storyChapter.Number + 1);
            if (nextChapter is not null && _storyProgress.IsUnlocked(nextChapter.Number))
            {
                _launchRequest = GameLaunchRequest.ForStory(nextChapter.Number);
                _storyChapter = nextChapter;
                StartGame();
                return;
            }
        }

        ReturnToChapterSelect();
    }

    private void PauseGame()
    {
        _paused = true;
        _pauseSelectedButton = 0;
        _pauseHoveredButton = -1;
        _gameTimer.Stop();
        _audio.SuspendMusic();
        Cursor = Cursors.Default;
        Invalidate();
    }

    private void ResumeGame()
    {
        _paused = false;
        _pauseHoveredButton = -1;
        _audio.ResumeMusic();
        _gameTimer.Start();
        Cursor = Cursors.Default;
        Invalidate();
    }

    private void HandlePauseMenuKey(KeyEventArgs e)
    {
        if (e.KeyCode == Keys.Escape)
        {
            ResumeGame();
            e.Handled = true;
            return;
        }

        if (e.KeyCode == Keys.M)
        {
            TogglePauseMusic();
            e.Handled = true;
            return;
        }

        if (e.KeyCode == Keys.S)
        {
            TogglePauseSoundEffects();
            e.Handled = true;
            return;
        }

        if (e.KeyCode is Keys.Up or Keys.Left)
        {
            SelectPauseButton((_pauseSelectedButton + 3) % 4);
            e.Handled = true;
            return;
        }

        if (e.KeyCode is Keys.Down or Keys.Right)
        {
            SelectPauseButton((_pauseSelectedButton + 1) % 4);
            e.Handled = true;
            return;
        }

        if (e.KeyCode is Keys.Enter or Keys.Space)
        {
            ActivatePauseButton(_pauseSelectedButton);
            e.Handled = true;
        }
    }

    private void SelectPauseButton(int index)
    {
        if (_pauseSelectedButton == index)
        {
            return;
        }

        _pauseSelectedButton = index;
        _pauseHoveredButton = -1;
        Cursor = Cursors.Default;
        _audio.PlayCue(SoundCue.MenuMove);
        Invalidate();
    }

    private void ActivatePauseButton(int index)
    {
        switch (index)
        {
            case 0:
                _audio.PlayCue(SoundCue.MenuMove);
                ResumeGame();
                break;
            case 1:
                TogglePauseMusic();
                break;
            case 2:
                TogglePauseSoundEffects();
                break;
            case 3:
                _audio.PlayCue(SoundCue.MenuMove);
                ReturnToMainMenu();
                break;
        }
    }

    private void TogglePauseMusic()
    {
        _audio.SetMusicEnabled(!_audio.MusicEnabled);
        _audio.PlayCue(SoundCue.MenuMove);
        Invalidate();
    }

    private void TogglePauseSoundEffects()
    {
        bool enabled = !_audio.SoundEffectsEnabled;
        if (!enabled)
        {
            _audio.PlayCue(SoundCue.MenuMove);
        }

        _audio.SetSoundEffectsEnabled(enabled);
        if (enabled)
        {
            _audio.PlayCue(SoundCue.MenuMove);
        }

        Invalidate();
    }

    private void ReturnToMainMenu()
    {
        _gameTimer.Stop();
        _paused = false;
        _pauseSelectedButton = 0;
        _pauseHoveredButton = -1;
        PersistStoryProgress();
        Cursor = Cursors.Default;
        ShowOpeningScreen();
        Invalidate();
    }

    private void ReturnToChapterSelect()
    {
        _gameTimer.Stop();
        _paused = false;
        _resultSelectedButton = 0;
        _resultHoveredButton = -1;
        PersistStoryProgress();
        Cursor = Cursors.Default;
        ShowOpeningScreen(openChapterSelect: true);
        Invalidate();
    }

    protected override void OnMouseMove(MouseEventArgs e)
    {
        base.OnMouseMove(e);
        if (_openingScreen is not null)
        {
            return;
        }

        if (IsStoryResultsVisible)
        {
            int resultHit = HitTestStoryResultButton(e.Location);
            if (resultHit == _resultHoveredButton)
            {
                return;
            }

            _resultHoveredButton = resultHit;
            if (resultHit >= 0)
            {
                _resultSelectedButton = resultHit;
                Cursor = Cursors.Hand;
            }
            else
            {
                Cursor = Cursors.Default;
            }

            Invalidate();
            return;
        }

        if (!_paused)
        {
            return;
        }

        int hit = HitTestPauseButton(e.Location);
        if (hit == _pauseHoveredButton)
        {
            return;
        }

        _pauseHoveredButton = hit;
        if (hit >= 0)
        {
            _pauseSelectedButton = hit;
            Cursor = Cursors.Hand;
        }
        else
        {
            Cursor = Cursors.Default;
        }

        Invalidate();
    }

    protected override void OnMouseLeave(EventArgs e)
    {
        base.OnMouseLeave(e);
        if (IsStoryResultsVisible)
        {
            _resultHoveredButton = -1;
            Cursor = Cursors.Default;
            Invalidate();
            return;
        }

        if (!_paused)
        {
            return;
        }

        _pauseHoveredButton = -1;
        Cursor = Cursors.Default;
        Invalidate();
    }

    protected override void OnMouseDown(MouseEventArgs e)
    {
        base.OnMouseDown(e);
        if (e.Button != MouseButtons.Left || _openingScreen is not null)
        {
            return;
        }

        if (IsStoryResultsVisible)
        {
            int resultHit = HitTestStoryResultButton(e.Location);
            if (resultHit >= 0)
            {
                ActivateStoryResultButton(resultHit);
            }

            return;
        }

        if (!_paused)
        {
            return;
        }

        int hit = HitTestPauseButton(e.Location);
        if (hit >= 0)
        {
            ActivatePauseButton(hit);
        }
    }

    private int HitTestStoryResultButton(Point location)
    {
        ResultButton[] buttons = GetStoryResultButtons();
        for (int i = 0; i < buttons.Length; i++)
        {
            if (buttons[i].Bounds.Contains(location))
            {
                return i;
            }
        }

        return -1;
    }

    private ResultButton[] GetStoryResultButtons()
    {
        const int buttonX = 175;
        const int buttonWidth = 250;
        const int buttonHeight = 40;
        return new[]
        {
            new ResultButton(
                new Rectangle(buttonX, 274, buttonWidth, buttonHeight),
                _won ? "CONTINUE" : "RETRY CHAPTER"),
            new ResultButton(
                new Rectangle(buttonX, 324, buttonWidth, buttonHeight),
                _won ? "REPLAY CHAPTER" : "CHAPTER SELECT"),
            new ResultButton(
                new Rectangle(buttonX, 374, buttonWidth, buttonHeight),
                "MAIN MENU")
        };
    }

    private int HitTestPauseButton(Point location)
    {
        PauseButton[] buttons = GetPauseButtons();
        for (int i = 0; i < buttons.Length; i++)
        {
            if (buttons[i].Bounds.Contains(location))
            {
                return i;
            }
        }

        return -1;
    }

    private PauseButton[] GetPauseButtons()
    {
        const int buttonX = 175;
        const int buttonWidth = 250;
        const int buttonHeight = 42;
        return new[]
        {
            new PauseButton(new Rectangle(buttonX, 151, buttonWidth, buttonHeight), "RESUME"),
            new PauseButton(
                new Rectangle(buttonX, 203, buttonWidth, buttonHeight),
                $"MUSIC  {OnOff(_audio.MusicEnabled)}"),
            new PauseButton(
                new Rectangle(buttonX, 255, buttonWidth, buttonHeight),
                $"SFX  {OnOff(_audio.SoundEffectsEnabled)}"),
            new PauseButton(
                new Rectangle(buttonX, 319, buttonWidth, buttonHeight),
                "QUIT TO MAIN MENU")
        };
    }

    private static string OnOff(bool enabled)
    {
        return enabled ? "ON" : "OFF";
    }

    private static bool IsOpposite(Point first, Point second)
    {
        return first.X == -second.X && first.Y == -second.Y;
    }

    private static bool IsUnitCardinal(Point direction)
    {
        return Math.Abs(direction.X) + Math.Abs(direction.Y) == 1;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);

        if (_openingScreen is not null || _snake.Count == 0)
        {
            e.Graphics.Clear(Color.FromArgb(11, 20, 29));
            return;
        }

        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        DrawHeader(e.Graphics);
        DrawBoard(e.Graphics);
        DrawFood(e.Graphics);
        DrawPhantomFruit(e.Graphics);
        DrawBossCaptureRadius(e.Graphics);
        DrawSlashWarning(e.Graphics);
        DrawBoss(e.Graphics);
        DrawBossSlashes(e.Graphics);
        DrawSnake(e.Graphics);
        DrawWren(e.Graphics);
        DrawBossDefeatEffect(e.Graphics);

        if (_paused)
        {
            DrawPauseMenu(e.Graphics);
        }
        else if (_storyIntroTimeRemainingMilliseconds > 0 && _storyChapter is not null)
        {
            DrawOverlay(
                e.Graphics,
                $"CHAPTER {_storyChapter.Number}  |  {_storyChapter.Title}",
                _storyChapter.Objective);
        }
        else if (_bossIntroTimeRemainingMilliseconds > 0)
        {
            DrawOverlay(
                e.Graphics,
                "THE HOLLOW KING",
                BossUsesSlashes
                    ? "Body pass is ON | Dodge sword crescents and surround him"
                    : "Body pass is ON | Surround it without touching it");
        }
        else if (_bossDefeatTimeRemainingMilliseconds > 0)
        {
            DrawOverlay(
                e.Graphics,
                "HOLLOW KING DEFEATED!",
                IsStoryMode
                    ? $"+{BossDefeatScore} points | Chapter complete"
                    : $"+{BossDefeatScore} points | Level up next");
        }
        else if (_levelUpTimeRemainingMilliseconds > 0)
        {
            DrawOverlay(
                e.Graphics,
                $"LEVEL {_pendingLevel}",
                GetLevelDescription(_pendingLevel));
        }
        else if (_gameOver)
        {
            if (IsStoryMode)
            {
                DrawStoryResults(e.Graphics);
            }
            else
            {
                DrawOverlay(
                    e.Graphics,
                    _gameOverTitle,
                    "Press Space to play again");
            }
        }
    }

    private void DrawHeader(Graphics graphics)
    {
        using SolidBrush headerBrush = new(Color.FromArgb(29, 39, 46));
        graphics.FillRectangle(headerBrush, 0, 0, BoardWidth, HeaderHeight);

        string statusText;
        Color statusColor;
        if (IsRecovering)
        {
            double secondsRemaining = _recoveryTimeRemainingMilliseconds / 1000d;
            statusText = $"LIFE USED | SAFE  {secondsRemaining:0.0}s";
            statusColor = Color.FromArgb(113, 222, 255);
        }
        else if (_extraLifeNoticeTimeRemainingMilliseconds > 0)
        {
            statusText = _lifeRewardNotice;
            statusColor = Color.FromArgb(113, 222, 255);
        }
        else if (_bossIntroTimeRemainingMilliseconds > 0)
        {
            statusText = "HOLLOW KING";
            statusColor = Color.FromArgb(255, 118, 76);
        }
        else if (_bossActive)
        {
            double secondsRemaining = Math.Max(
                0,
                CurrentBossConstrictDurationMilliseconds - _bossConstrictTimeMilliseconds) / 1000d;

            if (_bossEnclosed)
            {
                statusText = $"CONSTRICTING  {secondsRemaining:0.0}s";
                statusColor = Color.FromArgb(255, 213, 77);
            }
            else if (_bossConstrictTimeMilliseconds > 0)
            {
                statusText = $"PASS ON | OPEN  {secondsRemaining:0.0}s";
                statusColor = Color.FromArgb(255, 139, 85);
            }
            else
            {
                statusText = BossUsesSlashes
                    ? "PASS ON | DODGE SLASHES"
                    : "BODY PASS ON | SURROUND";
                statusColor = Color.FromArgb(255, 139, 85);
            }
        }
        else if (_bossDefeatTimeRemainingMilliseconds > 0)
        {
            statusText = IsStoryMode
                ? $"KING  +{BossDefeatScore} | CHAPTER CLEAR"
                : $"KING  +{BossDefeatScore}";
            statusColor = Color.FromArgb(255, 213, 77);
        }
        else if (_levelUpTimeRemainingMilliseconds > 0)
        {
            statusText = $"LEVEL {_pendingLevel}  UNLOCKED";
            statusColor = Color.FromArgb(118, 224, 255);
        }
        else if (IsPowered)
        {
            double secondsRemaining = _powerTimeRemainingMilliseconds / 1000d;
            statusText = _wrenActive
                ? $"PHANTOM  {secondsRemaining:0.0}s"
                : $"PHANTOM  {secondsRemaining:0.0}s | WREN DOWN";
            statusColor = Color.FromArgb(255, 216, 76);
        }
        else
        {
            statusText = IsStoryMode && _storyChapter is not null
                ? $"GOAL {_storyChapter.BossScoreTarget} | DEFEAT THE KING"
                : "WASD/Arrows | P pause | R reset";
            statusColor = Color.FromArgb(160, 177, 169);
        }

        string scoreText = IsStoryMode && _storyChapter is not null
            ? $"SCORE  {_score}  LIFE {_extraLives}  CH {_storyChapter.Number}"
            : $"SCORE  {_score}  BEST  {_highScore}  LIFE {_extraLives}  LV {_level}";

        TextRenderer.DrawText(
            graphics,
            scoreText,
            _scoreFont,
            new Rectangle(14, 0, 324, HeaderHeight),
            Color.FromArgb(236, 242, 238),
            TextFormatFlags.Left | TextFormatFlags.VerticalCenter);

        TextRenderer.DrawText(
            graphics,
            statusText,
            _helpFont,
            new Rectangle(338, 0, BoardWidth - 352, HeaderHeight),
            statusColor,
            TextFormatFlags.Right | TextFormatFlags.VerticalCenter);
    }

    private static void DrawBoard(Graphics graphics)
    {
        using SolidBrush lightCell = new(Color.FromArgb(35, 48, 43));
        using SolidBrush darkCell = new(Color.FromArgb(31, 43, 39));

        for (int y = 0; y < Rows; y++)
        {
            for (int x = 0; x < Columns; x++)
            {
                Brush brush = (x + y) % 2 == 0 ? lightCell : darkCell;
                graphics.FillRectangle(
                    brush,
                    x * CellSize,
                    HeaderHeight + y * CellSize,
                    CellSize,
                    CellSize);
            }
        }
    }

    private void DrawFood(Graphics graphics)
    {
        if (_won)
        {
            return;
        }

        Rectangle foodBounds = CellBounds(_food, inset: 3);
        using SolidBrush foodBrush = new(Color.FromArgb(241, 90, 79));
        using SolidBrush shineBrush = new(Color.FromArgb(255, 195, 174));

        graphics.FillEllipse(foodBrush, foodBounds);
        graphics.FillEllipse(
            shineBrush,
            foodBounds.X + 3,
            foodBounds.Y + 3,
            4,
            4);
    }

    private void DrawPhantomFruit(Graphics graphics)
    {
        if (!_phantomFruitActive || _won)
        {
            return;
        }

        CharacterArt.DrawPhantomFruit(
            graphics,
            CellBounds(_phantomFruit, inset: 0),
            _animationTick);
    }

    private void DrawBossCaptureRadius(Graphics graphics)
    {
        if (!_bossActive || _bossIntroTimeRemainingMilliseconds > 0)
        {
            return;
        }

        float progress = _bossConstrictTimeMilliseconds /
                         (float)CurrentBossConstrictDurationMilliseconds;
        int padding = (int)Math.Round(50 - 42 * progress);
        Rectangle ringBounds = BossPixelBounds(_bossPosition);
        ringBounds.Inflate(padding, padding);

        Color ringColor = _bossEnclosed
            ? Color.FromArgb(235, 255, 207, 69)
            : Color.FromArgb(210, 255, 104, 75);
        using SolidBrush fillBrush = new(Color.FromArgb(
            _bossEnclosed ? 28 : 12,
            ringColor.R,
            ringColor.G,
            ringColor.B));
        using Pen ringPen = new(ringColor, _bossEnclosed ? 4f : 3f)
        {
            DashStyle = _bossEnclosed ? DashStyle.Solid : DashStyle.Dash,
            DashOffset = _animationTick % 12
        };

        graphics.FillEllipse(fillBrush, ringBounds);
        graphics.DrawEllipse(ringPen, ringBounds);
    }

    private void DrawBoss(Graphics graphics)
    {
        if (!_bossActive)
        {
            return;
        }

        CharacterArt.DrawHollowKing(
            graphics,
            BossPixelBounds(_bossPosition),
            _slashWarningTimeRemainingMilliseconds > 0);
    }

    private void DrawSlashWarning(Graphics graphics)
    {
        if (_slashWarningTimeRemainingMilliseconds <= 0)
        {
            return;
        }

        bool brightFrame = IsBrightSlashFrame();
        using SolidBrush laneBrush = new(Color.FromArgb(
            brightFrame ? 88 : 42,
            232,
            102,
            171));
        using Pen edgePen = new(Color.FromArgb(190, 255, 205, 235), 2f);

        Point cell = _slashWarningOrigin;
        int maximumCells = Math.Max(Columns, Rows) + 1;
        for (int i = 0; i < maximumCells; i++)
        {
            if (cell.X < 0 || cell.X >= Columns || cell.Y < 0 || cell.Y >= Rows)
            {
                break;
            }

            Rectangle bounds = CellBounds(cell, inset: 2);
            graphics.FillRectangle(laneBrush, bounds);
            graphics.DrawRectangle(edgePen, bounds);
            cell = new Point(
                cell.X + _slashWarningDirection.X,
                cell.Y + _slashWarningDirection.Y);
        }
    }

    private bool IsBrightSlashFrame()
    {
        return (_animationTick / 2) % 2 == 0;
    }

    private void DrawBossSlashes(Graphics graphics)
    {
        using SolidBrush glowBrush = new(Color.FromArgb(90, 204, 105, 242));
        using Pen outerPen = new(Color.FromArgb(239, 196, 110, 225), 4f);
        using Pen innerPen = new(Color.FromArgb(255, 242, 226), 2f);

        foreach (SwordSlash slash in _bossSlashes)
        {
            Rectangle glowBounds = CellBounds(slash.Position, inset: 1);
            Rectangle slashBounds = CellBounds(slash.Position, inset: 4);
            graphics.FillEllipse(glowBrush, glowBounds);

            if (slash.Direction.X != 0)
            {
                int startAngle = slash.Direction.X > 0 ? 245 : 65;
                graphics.DrawArc(outerPen, slashBounds, startAngle, 230);
                graphics.DrawArc(innerPen, slashBounds, startAngle, 230);
            }
            else
            {
                int startAngle = slash.Direction.Y > 0 ? 335 : 155;
                graphics.DrawArc(outerPen, slashBounds, startAngle, 230);
                graphics.DrawArc(innerPen, slashBounds, startAngle, 230);
            }
        }
    }

    private void DrawBossDefeatEffect(Graphics graphics)
    {
        if (_bossDefeatTimeRemainingMilliseconds <= 0)
        {
            return;
        }

        float progress = 1f - _bossDefeatTimeRemainingMilliseconds /
                         (float)BossDefeatBannerMilliseconds;
        Rectangle bossBounds = BossPixelBounds(_bossPosition);
        int centerX = bossBounds.X + bossBounds.Width / 2;
        int centerY = bossBounds.Y + bossBounds.Height / 2;
        int radius = 18 + (int)(progress * 70);
        int alpha = Math.Max(0, (int)(190 * (1f - progress)));

        using SolidBrush glowBrush = new(Color.FromArgb(alpha, 255, 183, 54));
        using Pen rayPen = new(Color.FromArgb(alpha, 255, 231, 145), 4f);
        graphics.FillEllipse(
            glowBrush,
            centerX - radius,
            centerY - radius,
            radius * 2,
            radius * 2);

        for (int i = 0; i < 8; i++)
        {
            double angle = i * Math.PI / 4;
            int innerX = centerX + (int)(Math.Cos(angle) * radius * 0.65);
            int innerY = centerY + (int)(Math.Sin(angle) * radius * 0.65);
            int outerX = centerX + (int)(Math.Cos(angle) * radius);
            int outerY = centerY + (int)(Math.Sin(angle) * radius);
            graphics.DrawLine(rayPen, innerX, innerY, outerX, outerY);
        }
    }

    private void DrawSnake(Graphics graphics)
    {
        bool recoveryFlash = IsRecovering && _animationTick % 2 == 0;
        bool warningFlash = IsPowered &&
                            _powerTimeRemainingMilliseconds <= 1000 &&
                            _animationTick % 2 == 0;
        Color headColor = IsRecovering
            ? recoveryFlash ? Color.White : Color.FromArgb(101, 222, 255)
            : IsPowered
                ? warningFlash ? Color.White : Color.FromArgb(255, 220, 70)
                : Color.FromArgb(172, 235, 93);
        Color bodyColor = IsRecovering
            ? recoveryFlash ? Color.FromArgb(210, 246, 255) : Color.FromArgb(48, 157, 224)
            : IsPowered
                ? warningFlash ? Color.FromArgb(255, 238, 166) : Color.FromArgb(244, 155, 51)
                : Color.FromArgb(102, 195, 95);

        using SolidBrush headBrush = new(headColor);
        using SolidBrush bodyBrush = new(bodyColor);
        using SolidBrush eyeBrush = new(Color.FromArgb(21, 43, 31));

        for (int i = _snake.Count - 1; i >= 0; i--)
        {
            Rectangle bounds = CellBounds(_snake[i], inset: 1);
            graphics.FillRectangle(i == 0 ? headBrush : bodyBrush, bounds);
        }

        Point head = _snake[0];
        int headX = head.X * CellSize;
        int headY = HeaderHeight + head.Y * CellSize;

        Point firstEye;
        Point secondEye;
        if (_direction.X != 0)
        {
            int eyeX = _direction.X > 0 ? headX + 13 : headX + 4;
            firstEye = new Point(eyeX, headY + 5);
            secondEye = new Point(eyeX, headY + 12);
        }
        else
        {
            int eyeY = _direction.Y > 0 ? headY + 13 : headY + 4;
            firstEye = new Point(headX + 5, eyeY);
            secondEye = new Point(headX + 12, eyeY);
        }

        graphics.FillEllipse(eyeBrush, firstEye.X, firstEye.Y, 3, 3);
        graphics.FillEllipse(eyeBrush, secondEye.X, secondEye.Y, 3, 3);
    }

    private void DrawWren(Graphics graphics)
    {
        if (!_wrenActive)
        {
            return;
        }

        CharacterArt.DrawWren(
            graphics,
            CellBounds(_wren, inset: 0),
            IsPowered);
    }

    private void DrawPauseMenu(Graphics graphics)
    {
        Rectangle panelBounds = new(130, 64, 340, 353);
        using SolidBrush shadeBrush = new(Color.FromArgb(205, 7, 12, 17));
        using SolidBrush panelBrush = new(Color.FromArgb(242, 19, 31, 42));
        using Pen panelPen = new(Color.FromArgb(132, 220, 194), 2f);
        graphics.FillRectangle(shadeBrush, ClientRectangle);
        graphics.FillRectangle(panelBrush, panelBounds);
        graphics.DrawRectangle(panelPen, panelBounds);

        TextRenderer.DrawText(
            graphics,
            "PAUSED",
            _messageFont,
            new Rectangle(panelBounds.X, panelBounds.Y + 15, panelBounds.Width, 47),
            Color.FromArgb(238, 242, 235),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        TextRenderer.DrawText(
            graphics,
            "AUDIO & OPTIONS",
            _helpFont,
            new Rectangle(panelBounds.X, panelBounds.Y + 64, panelBounds.Width, 25),
            Color.FromArgb(123, 220, 200),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);

        PauseButton[] buttons = GetPauseButtons();
        for (int i = 0; i < buttons.Length; i++)
        {
            bool selected = i == _pauseSelectedButton;
            bool hovered = i == _pauseHoveredButton;
            Color fillColor = selected || hovered
                ? Color.FromArgb(53, 112, 103)
                : Color.FromArgb(28, 45, 57);
            Color borderColor = selected || hovered
                ? Color.FromArgb(145, 242, 214)
                : Color.FromArgb(67, 104, 112);
            using SolidBrush buttonBrush = new(fillColor);
            using Pen buttonPen = new(borderColor, selected ? 2f : 1f);
            graphics.FillRectangle(buttonBrush, buttons[i].Bounds);
            graphics.DrawRectangle(buttonPen, buttons[i].Bounds);
            TextRenderer.DrawText(
                graphics,
                buttons[i].Label,
                _helpFont,
                buttons[i].Bounds,
                selected || hovered ? Color.White : Color.FromArgb(204, 217, 215),
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }

        TextRenderer.DrawText(
            graphics,
            "P / Esc: resume    M: music    S: effects",
            _helpFont,
            new Rectangle(panelBounds.X + 12, panelBounds.Bottom - 42, panelBounds.Width - 24, 25),
            Color.FromArgb(139, 158, 164),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
    }

    private void DrawStoryResults(Graphics graphics)
    {
        Rectangle panelBounds = new(105, 68, 390, 374);
        using SolidBrush shadeBrush = new(Color.FromArgb(215, 7, 12, 17));
        using SolidBrush panelBrush = new(Color.FromArgb(246, 19, 31, 42));
        using Pen panelPen = new(
            _won ? Color.FromArgb(245, 211, 126) : Color.FromArgb(220, 112, 104),
            2f);
        graphics.FillRectangle(shadeBrush, ClientRectangle);
        graphics.FillRectangle(panelBrush, panelBounds);
        graphics.DrawRectangle(panelPen, panelBounds);

        TextRenderer.DrawText(
            graphics,
            _gameOverTitle,
            _messageFont,
            new Rectangle(panelBounds.X + 12, panelBounds.Y + 17, panelBounds.Width - 24, 44),
            Color.White,
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);

        string chapterTitle = _storyChapter is null
            ? "STORY MODE"
            : $"CHAPTER {_storyChapter.Number}  |  {_storyChapter.Title}";
        TextRenderer.DrawText(
            graphics,
            chapterTitle,
            _helpFont,
            new Rectangle(panelBounds.X + 12, panelBounds.Y + 68, panelBounds.Width - 24, 27),
            Color.FromArgb(123, 220, 200),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);

        TextRenderer.DrawText(
            graphics,
            $"FINAL SCORE  {_score}",
            _scoreFont,
            new Rectangle(panelBounds.X + 12, panelBounds.Y + 103, panelBounds.Width - 24, 30),
            Color.FromArgb(245, 211, 126),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);

        string resultText = _won
            ? _storyChapter?.CompletionText ?? "Chapter complete."
            : "The checkpoint remains open. Regroup and try the chapter again.";
        TextRenderer.DrawText(
            graphics,
            resultText,
            _helpFont,
            new Rectangle(panelBounds.X + 32, panelBounds.Y + 139, panelBounds.Width - 64, 55),
            Color.FromArgb(203, 218, 213),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.Top | TextFormatFlags.WordBreak);

        ResultButton[] buttons = GetStoryResultButtons();
        for (int i = 0; i < buttons.Length; i++)
        {
            bool selected = i == _resultSelectedButton;
            bool hovered = i == _resultHoveredButton;
            Color fillColor = selected || hovered
                ? Color.FromArgb(53, 112, 103)
                : Color.FromArgb(28, 45, 57);
            Color borderColor = selected || hovered
                ? Color.FromArgb(145, 242, 214)
                : Color.FromArgb(67, 104, 112);
            using SolidBrush buttonBrush = new(fillColor);
            using Pen buttonPen = new(borderColor, selected ? 2f : 1f);
            graphics.FillRectangle(buttonBrush, buttons[i].Bounds);
            graphics.DrawRectangle(buttonPen, buttons[i].Bounds);
            TextRenderer.DrawText(
                graphics,
                buttons[i].Label,
                _helpFont,
                buttons[i].Bounds,
                selected || hovered ? Color.White : Color.FromArgb(204, 217, 215),
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }

        TextRenderer.DrawText(
            graphics,
            "Arrows: choose   Enter: select   R: retry   Esc: chapters",
            _helpFont,
            new Rectangle(panelBounds.X + 12, panelBounds.Bottom - 24, panelBounds.Width - 24, 18),
            Color.FromArgb(139, 158, 164),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
    }

    private void DrawOverlay(Graphics graphics, string title, string instructions)
    {
        Rectangle boardBounds = new(0, HeaderHeight, BoardWidth, BoardHeight);
        using SolidBrush shade = new(Color.FromArgb(185, 12, 18, 16));
        graphics.FillRectangle(shade, boardBounds);

        Rectangle titleBounds = new(0, HeaderHeight + BoardHeight / 2 - 55, BoardWidth, 50);
        Rectangle helpBounds = new(0, titleBounds.Bottom + 8, BoardWidth, 35);

        TextRenderer.DrawText(
            graphics,
            title,
            _messageFont,
            titleBounds,
            Color.White,
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);

        TextRenderer.DrawText(
            graphics,
            instructions,
            _helpFont,
            helpBounds,
            Color.FromArgb(190, 226, 199),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
    }

    private static string GetLevelDescription(int level)
    {
        return level switch
        {
            2 => "Game speed increased",
            3 => "Wren predicts your path | Phantom lasts 4.5s",
            4 => "Wren moves faster | The King grows stronger",
            5 => "Sword crescents unlocked",
            6 => "Maximum game speed | Phantom lasts 3.0s",
            _ => "Hollow King movement and slash rate increased"
        };
    }

    private static Rectangle CellBounds(Point cell, int inset)
    {
        return new Rectangle(
            cell.X * CellSize + inset,
            HeaderHeight + cell.Y * CellSize + inset,
            CellSize - inset * 2,
            CellSize - inset * 2);
    }

    private static Rectangle BossPixelBounds(Point position)
    {
        return new Rectangle(
            position.X * CellSize,
            HeaderHeight + position.Y * CellSize,
            BossSize * CellSize,
            BossSize * CellSize);
    }

    private sealed class SwordSlash
    {
        public SwordSlash(Point position, Point direction)
        {
            Position = position;
            Direction = direction;
        }

        public Point Position { get; set; }

        public Point Direction { get; }

        public int MoveCounter { get; set; }
    }

    private readonly record struct PauseButton(Rectangle Bounds, string Label);

    private readonly record struct ResultButton(Rectangle Bounds, string Label);

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            PersistStoryProgress();
            _gameTimer.Dispose();
            _audio.Dispose();
            _scoreFont.Dispose();
            _messageFont.Dispose();
            _helpFont.Dispose();
            _applicationIcon?.Dispose();
        }

        base.Dispose(disposing);
    }
}
