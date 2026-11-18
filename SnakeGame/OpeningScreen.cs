using System.Drawing.Drawing2D;

namespace SnakeGame;

internal sealed class OpeningScreen : Control
{
    private readonly AudioManager _audio;
    private readonly StoryProgress _storyProgress;
    private readonly System.Windows.Forms.Timer _animationTimer = new();
    private readonly Font _titleFont = new("Georgia", 34f, FontStyle.Bold);
    private readonly Font _subtitleFont = new("Segoe UI Semibold", 13f);
    private readonly Font _buttonFont = new("Segoe UI Semibold", 12f);
    private readonly Font _sectionFont = new("Segoe UI Semibold", 11f);
    private readonly Font _bodyFont = new("Segoe UI", 9.5f);
    private readonly Font _smallFont = new("Segoe UI", 8.25f);
    private ScreenPage _page = ScreenPage.Menu;
    private int _selectedButton;
    private int _hoveredButton = -1;
    private int _animationFrame;

    public OpeningScreen(
        AudioManager audio,
        StoryProgress storyProgress,
        bool openChapterSelect = false)
    {
        _audio = audio;
        _storyProgress = storyProgress;
        _page = openChapterSelect ? ScreenPage.ChapterSelect : ScreenPage.Menu;
        Dock = DockStyle.Fill;
        TabStop = true;
        Cursor = Cursors.Default;

        SetStyle(
            ControlStyles.AllPaintingInWmPaint |
            ControlStyles.OptimizedDoubleBuffer |
            ControlStyles.UserPaint |
            ControlStyles.Selectable,
            true);

        _animationTimer.Interval = 50;
        _animationTimer.Tick += (_, _) =>
        {
            _animationFrame++;
            Invalidate();
        };
        _animationTimer.Start();
    }

    public event Action<GameLaunchRequest>? StartRequested;

    public event EventHandler? ExitRequested;

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        DrawBackground(e.Graphics);

        switch (_page)
        {
            case ScreenPage.Menu:
                DrawMenu(e.Graphics);
                break;
            case ScreenPage.ModeSelect:
                DrawModeSelect(e.Graphics);
                break;
            case ScreenPage.ChapterSelect:
                DrawChapterSelect(e.Graphics);
                break;
            default:
                DrawRules(e.Graphics);
                break;
        }
    }

    protected override void OnPreviewKeyDown(PreviewKeyDownEventArgs e)
    {
        if (e.KeyCode is Keys.Up or Keys.Down or Keys.Left or Keys.Right)
        {
            e.IsInputKey = true;
        }

        base.OnPreviewKeyDown(e);
    }

    protected override void OnKeyDown(KeyEventArgs e)
    {
        if (e.KeyCode == Keys.M)
        {
            ToggleMusic();
            e.Handled = true;
            return;
        }

        if (e.KeyCode == Keys.S)
        {
            ToggleSoundEffects();
            e.Handled = true;
            return;
        }

        if (e.KeyCode == Keys.Escape)
        {
            switch (_page)
            {
                case ScreenPage.Menu:
                    ExitRequested?.Invoke(this, EventArgs.Empty);
                    break;
                case ScreenPage.ChapterSelect:
                    SetPage(ScreenPage.ModeSelect);
                    break;
                case ScreenPage.RulesBoss:
                    SetPage(ScreenPage.RulesBasics);
                    break;
                default:
                    SetPage(ScreenPage.Menu);
                    break;
            }

            e.Handled = true;
            return;
        }

        int buttonCount = GetButtons().Length;
        if (e.KeyCode is Keys.Up or Keys.Left)
        {
            SelectButton((_selectedButton - 1 + buttonCount) % buttonCount);
            e.Handled = true;
            return;
        }

        if (e.KeyCode is Keys.Down or Keys.Right)
        {
            SelectButton((_selectedButton + 1) % buttonCount);
            e.Handled = true;
            return;
        }

        if (e.KeyCode is Keys.Enter or Keys.Space)
        {
            ActivateButton(_selectedButton);
            e.Handled = true;
            return;
        }

        base.OnKeyDown(e);
    }

    protected override void OnMouseMove(MouseEventArgs e)
    {
        base.OnMouseMove(e);
        int hit = HitTest(e.Location);
        if (hit == _hoveredButton)
        {
            return;
        }

        _hoveredButton = hit;
        if (hit >= 0)
        {
            _selectedButton = hit;
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
        _hoveredButton = -1;
        Cursor = Cursors.Default;
        Invalidate();
    }

    protected override void OnMouseDown(MouseEventArgs e)
    {
        base.OnMouseDown(e);
        if (e.Button != MouseButtons.Left)
        {
            return;
        }

        int hit = HitTest(e.Location);
        if (hit >= 0)
        {
            ActivateButton(hit);
        }
    }

    private void DrawBackground(Graphics graphics)
    {
        using LinearGradientBrush background = new(
            ClientRectangle,
            Color.FromArgb(11, 20, 29),
            Color.FromArgb(39, 25, 55),
            LinearGradientMode.Vertical);
        graphics.FillRectangle(background, ClientRectangle);

        using Pen gridPen = new(Color.FromArgb(22, 109, 174, 159), 1f);
        for (int x = -20; x < Width + 40; x += 40)
        {
            graphics.DrawLine(gridPen, x, 0, x - 80, Height);
        }

        for (int y = 20; y < Height; y += 40)
        {
            graphics.DrawLine(gridPen, 0, y, Width, y);
        }

        for (int i = 0; i < 18; i++)
        {
            int x = (i * 83 + _animationFrame * (i % 3 + 1)) % Math.Max(1, Width);
            int y = 24 + (i * 47) % Math.Max(1, Height - 48);
            int alpha = 45 + (int)(35 * (Math.Sin((_animationFrame + i * 7) / 11d) + 1d));
            using SolidBrush wispBrush = new(Color.FromArgb(alpha, 116, 226, 205));
            graphics.FillEllipse(wispBrush, x, y, 3 + i % 3, 3 + i % 3);
        }
    }

    private void DrawMenu(Graphics graphics)
    {
        DrawSerpentMark(graphics);
        CharacterArt.DrawWren(
            graphics,
            new Rectangle(472, 72 + (int)(Math.Sin(_animationFrame / 8d) * 3), 72, 72),
            vulnerable: false);

        TextRenderer.DrawText(
            graphics,
            "SNAKE",
            _titleFont,
            new Rectangle(0, 38, Width, 52),
            Color.FromArgb(230, 244, 231),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        TextRenderer.DrawText(
            graphics,
            "A D V E N T U R E S",
            _subtitleFont,
            new Rectangle(0, 88, Width, 30),
            Color.FromArgb(111, 224, 201),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);

        TextRenderer.DrawText(
            graphics,
            "VERSION 1.0",
            _smallFont,
            new Rectangle(0, 118, Width, 24),
            Color.FromArgb(183, 156, 207),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);

        DrawButtons(graphics);
        TextRenderer.DrawText(
            graphics,
            "CREATED BY",
            _smallFont,
            new Rectangle(20, Height - 84, Width - 40, 18),
            Color.FromArgb(245, 211, 126),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        TextRenderer.DrawText(
            graphics,
            "Justin Conferido  |  Najem Alayoubi  |  Merj Din",
            _smallFont,
            new Rectangle(20, Height - 66, Width - 40, 20),
            Color.FromArgb(196, 211, 207),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        TextRenderer.DrawText(
            graphics,
            "Arrows: move menu   Enter: select   M: music   S: effects",
            _smallFont,
            new Rectangle(20, Height - 33, Width - 40, 22),
            Color.FromArgb(137, 159, 166),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
    }

    private void DrawSerpentMark(Graphics graphics)
    {
        int wave = (int)(Math.Sin(_animationFrame / 10d) * 4);
        using SolidBrush bodyBrush = new(Color.FromArgb(57, 143, 119));
        using SolidBrush headBrush = new(Color.FromArgb(130, 222, 132));
        using SolidBrush eyeBrush = new(Color.FromArgb(17, 30, 27));

        for (int i = 0; i < 11; i++)
        {
            int x = 45 + i * 15;
            int y = 100 + (int)(Math.Sin((i + _animationFrame / 8d) * 0.72d) * 16d);
            graphics.FillEllipse(i == 10 ? headBrush : bodyBrush, x, y + wave, 18, 18);
        }

        graphics.FillEllipse(eyeBrush, 201, 105 + wave, 3, 3);
    }

    private void DrawModeSelect(Graphics graphics)
    {
        DrawPageTitle(
            graphics,
            "CHOOSE YOUR PATH",
            "Story checkpoints or the original endless score chase");
        DrawButtons(graphics);

        DrawPageDescription(
            graphics,
            new Rectangle(62, 164, Width - 124, 42),
            "A finite chapter journey with saved progress, story objectives, and a final victory.");
        DrawPageDescription(
            graphics,
            new Rectangle(62, 269, Width - 124, 42),
            "The original Adventure rules. Defeat the Hollow King every 500 points and climb forever.");
    }

    private void DrawChapterSelect(Graphics graphics)
    {
        DrawPageTitle(
            graphics,
            "STORY MODE",
            "Cleared chapters remain complete between sessions");
        DrawButtons(graphics);

        int chapterIndex = Math.Min(_selectedButton, StoryChapter.All.Count - 1);
        StoryChapter chapter = StoryChapter.All[chapterIndex];
        string chapterState = _storyProgress.IsCompleted(chapter.Number)
            ? "COMPLETE"
            : _storyProgress.IsUnlocked(chapter.Number)
                ? "UNLOCKED"
                : "LOCKED";
        DrawRuleCard(
            graphics,
            new Rectangle(310, 118, 255, 214),
            $"CHAPTER {chapter.Number}  |  {chapterState}",
            $"{chapter.Title}\n\n{chapter.IntroText}\n\nOBJECTIVE: {chapter.Objective}");

        string progressText = _storyProgress.IsCompleted(chapter.Number)
            ? "Replay available"
            : _storyProgress.IsUnlocked(chapter.Number)
                ? "Defeat the boss to save this checkpoint"
                : "Complete the previous chapter to unlock";
        TextRenderer.DrawText(
            graphics,
            progressText,
            _sectionFont,
            new Rectangle(310, 342, 255, 42),
            _storyProgress.IsCompleted(chapter.Number)
                ? Color.FromArgb(245, 211, 126)
                : Color.FromArgb(123, 220, 200),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.WordBreak);

        TextRenderer.DrawText(
            graphics,
            "New chapters can be added without changing this menu flow.",
            _smallFont,
            new Rectangle(310, 389, 255, 30),
            Color.FromArgb(137, 159, 166),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.WordBreak);
    }

    private void DrawPageTitle(Graphics graphics, string title, string subtitle)
    {
        TextRenderer.DrawText(
            graphics,
            title,
            _subtitleFont,
            new Rectangle(20, 34, Width - 40, 38),
            Color.FromArgb(239, 230, 204),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        TextRenderer.DrawText(
            graphics,
            subtitle,
            _bodyFont,
            new Rectangle(30, 73, Width - 60, 30),
            Color.FromArgb(183, 202, 196),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
    }

    private void DrawPageDescription(Graphics graphics, Rectangle bounds, string text)
    {
        TextRenderer.DrawText(
            graphics,
            text,
            _bodyFont,
            bounds,
            Color.FromArgb(203, 218, 213),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.Top | TextFormatFlags.WordBreak);
    }

    private void DrawRules(Graphics graphics)
    {
        string pageTitle = _page == ScreenPage.RulesBasics
            ? "FIELD GUIDE  1 / 2"
            : "FIELD GUIDE  2 / 2";
        TextRenderer.DrawText(
            graphics,
            pageTitle,
            _subtitleFont,
            new Rectangle(20, 18, Width - 40, 34),
            Color.FromArgb(239, 230, 204),
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);

        if (_page == ScreenPage.RulesBasics)
        {
            DrawBasicRules(graphics);
        }
        else
        {
            DrawBossRules(graphics);
        }

        DrawButtons(graphics);
    }

    private void DrawBasicRules(Graphics graphics)
    {
        DrawRuleCard(graphics, new Rectangle(28, 65, 258, 155), "MOVE & SURVIVE",
            "Use Arrow keys or WASD. The snake wraps through every board edge. Eat red fruit to grow and earn 10 points. Press P for pause, audio, and main-menu options. Press R to restart.");
        DrawRuleCard(graphics, new Rectangle(314, 65, 258, 155), "WREN THE HUNTER",
            "Wren tracks the snake across wraparound edges. Touching him normally ends the run. During Phantom power he becomes vulnerable, flees, and is worth 50 points.");
        DrawRuleCard(graphics, new Rectangle(28, 238, 258, 155), "PHANTOM FRUIT",
            "A gold-and-violet Phantom Fruit appears after every five red fruits. It powers the snake temporarily. The duration becomes shorter at higher levels.");
        DrawRuleCard(graphics, new Rectangle(314, 238, 258, 155), "EXTRA LIFE",
            "One life is offered 200 points before each boss. Only one can be stored. If already full, the reward becomes 50 points. A used life grants brief protection.");
    }

    private void DrawBossRules(Graphics graphics)
    {
        DrawRuleCard(graphics, new Rectangle(28, 62, 544, 118), "THE HOLLOW KING",
            "A boss arrives every 500 points and Wren leaves the board. Body pass-through is active during the fight: coil around the King until he cannot reach the outside. Hold the enclosure as the capture ring contracts. Touching the King or a sword crescent costs a life or ends the run.");

        Rectangle tableBounds = new(28, 194, 544, 211);
        using SolidBrush tableBrush = new(Color.FromArgb(194, 18, 29, 39));
        using Pen borderPen = new(Color.FromArgb(96, 143, 196, 179));
        graphics.FillRectangle(tableBrush, tableBounds);
        graphics.DrawRectangle(borderPen, tableBounds);

        string[] headers = { "SCORE", "SPEED", "WREN", "POWER", "BOSS" };
        int[] widths = { 92, 68, 132, 70, 182 };
        string[,] rows =
        {
            { "0-499", "95ms", "Tracks", "5.0s", "Base" },
            { "500-999", "90ms", "Faster", "5.0s", "Moves faster" },
            { "1000-1499", "85ms", "Predicts 2", "4.5s", "+0.5s coil" },
            { "1500-1999", "80ms", "2-tick move", "4.0s", "Stronger" },
            { "2000-2499", "75ms", "Predicts 3", "3.5s", "Slashes unlock" },
            { "2500+", "70ms", "Maximum", "3.0s", "Capped scaling" }
        };

        int x = tableBounds.X;
        for (int column = 0; column < headers.Length; column++)
        {
            TextRenderer.DrawText(
                graphics,
                headers[column],
                _smallFont,
                new Rectangle(x + 4, tableBounds.Y + 5, widths[column] - 8, 24),
                Color.FromArgb(245, 211, 126),
                TextFormatFlags.Left | TextFormatFlags.VerticalCenter);
            x += widths[column];
        }

        for (int row = 0; row < rows.GetLength(0); row++)
        {
            int rowY = tableBounds.Y + 31 + row * 29;
            using SolidBrush rowBrush = new(Color.FromArgb(
                row % 2 == 0 ? 30 : 14,
                101,
                190,
                173));
            graphics.FillRectangle(rowBrush, tableBounds.X + 1, rowY, tableBounds.Width - 2, 28);
            x = tableBounds.X;

            for (int column = 0; column < headers.Length; column++)
            {
                TextRenderer.DrawText(
                    graphics,
                    rows[row, column],
                    _smallFont,
                    new Rectangle(x + 4, rowY, widths[column] - 8, 28),
                    Color.FromArgb(213, 225, 220),
                    TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
                x += widths[column];
            }
        }
    }

    private void DrawRuleCard(Graphics graphics, Rectangle bounds, string title, string body)
    {
        using SolidBrush cardBrush = new(Color.FromArgb(205, 18, 30, 40));
        using Pen borderPen = new(Color.FromArgb(94, 116, 198, 177));
        graphics.FillRectangle(cardBrush, bounds);
        graphics.DrawRectangle(borderPen, bounds);

        TextRenderer.DrawText(
            graphics,
            title,
            _sectionFont,
            new Rectangle(bounds.X + 12, bounds.Y + 9, bounds.Width - 24, 25),
            Color.FromArgb(245, 211, 126),
            TextFormatFlags.Left | TextFormatFlags.VerticalCenter);
        TextRenderer.DrawText(
            graphics,
            body,
            _bodyFont,
            new Rectangle(bounds.X + 12, bounds.Y + 38, bounds.Width - 24, bounds.Height - 48),
            Color.FromArgb(210, 224, 220),
            TextFormatFlags.Left | TextFormatFlags.Top | TextFormatFlags.WordBreak);
    }

    private void DrawButtons(Graphics graphics)
    {
        MenuButton[] buttons = GetButtons();
        for (int i = 0; i < buttons.Length; i++)
        {
            Rectangle bounds = buttons[i].Bounds;
            bool selected = i == _selectedButton;
            bool hovered = i == _hoveredButton;
            Color fillColor = selected || hovered
                ? Color.FromArgb(225, 43, 108, 99)
                : Color.FromArgb(218, 20, 36, 46);
            Color borderColor = selected || hovered
                ? Color.FromArgb(126, 238, 205)
                : Color.FromArgb(70, 128, 137);

            using SolidBrush fillBrush = new(fillColor);
            using Pen borderPen = new(borderColor, selected ? 2f : 1f);
            graphics.FillRectangle(fillBrush, bounds);
            graphics.DrawRectangle(borderPen, bounds);
            TextRenderer.DrawText(
                graphics,
                buttons[i].Label,
                _buttonFont,
                bounds,
                selected || hovered ? Color.White : Color.FromArgb(203, 215, 211),
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
    }

    private MenuButton[] GetButtons()
    {
        if (_page == ScreenPage.Menu)
        {
            int x = Width / 2 - 142;
            return new[]
            {
                new MenuButton(new Rectangle(x, 170, 284, 40), "PLAY"),
                new MenuButton(new Rectangle(x, 218, 284, 40), "HOW TO PLAY"),
                new MenuButton(new Rectangle(x, 266, 284, 40), $"MUSIC  {OnOff(_audio.MusicEnabled)}"),
                new MenuButton(new Rectangle(x, 314, 284, 40), $"SFX  {OnOff(_audio.SoundEffectsEnabled)}"),
                new MenuButton(new Rectangle(x, 362, 284, 40), "EXIT")
            };
        }

        if (_page == ScreenPage.ModeSelect)
        {
            int x = Width / 2 - 170;
            return new[]
            {
                new MenuButton(new Rectangle(x, 116, 340, 44), "STORY MODE"),
                new MenuButton(new Rectangle(x, 221, 340, 44), "ENDLESS ADVENTURE"),
                new MenuButton(new Rectangle(x, 341, 340, 40), "BACK")
            };
        }

        if (_page == ScreenPage.ChapterSelect)
        {
            List<MenuButton> buttons = new();
            for (int i = 0; i < StoryChapter.All.Count; i++)
            {
                StoryChapter chapter = StoryChapter.All[i];
                string state = _storyProgress.IsCompleted(chapter.Number)
                    ? "  |  DONE"
                    : _storyProgress.IsUnlocked(chapter.Number)
                        ? string.Empty
                        : "  |  LOCKED";
                buttons.Add(new MenuButton(
                    new Rectangle(34, 118 + i * 47, 252, 40),
                    $"{chapter.Number}  {chapter.Title}{state}"));
            }

            buttons.Add(new MenuButton(new Rectangle(34, 371, 252, 40), "BACK"));
            return buttons.ToArray();
        }

        int buttonY = Height - 59;
        if (_page == ScreenPage.RulesBasics)
        {
            return new[]
            {
                new MenuButton(new Rectangle(28, buttonY, 145, 40), "BACK"),
                new MenuButton(new Rectangle(427, buttonY, 145, 40), "NEXT")
            };
        }

        return new[]
        {
            new MenuButton(new Rectangle(28, buttonY, 145, 40), "BACK"),
            new MenuButton(new Rectangle(397, buttonY, 175, 40), "START GAME")
        };
    }

    private void ActivateButton(int index)
    {
        _audio.PlayCue(SoundCue.MenuMove);

        if (_page == ScreenPage.Menu)
        {
            switch (index)
            {
                case 0:
                    SetPage(ScreenPage.ModeSelect);
                    break;
                case 1:
                    SetPage(ScreenPage.RulesBasics);
                    break;
                case 2:
                    ToggleMusic();
                    break;
                case 3:
                    ToggleSoundEffects();
                    break;
                case 4:
                    ExitRequested?.Invoke(this, EventArgs.Empty);
                    break;
            }

            return;
        }

        if (_page == ScreenPage.ModeSelect)
        {
            switch (index)
            {
                case 0:
                    SetPage(ScreenPage.ChapterSelect);
                    break;
                case 1:
                    StartGame(GameLaunchRequest.Endless);
                    break;
                case 2:
                    SetPage(ScreenPage.Menu);
                    break;
            }

            return;
        }

        if (_page == ScreenPage.ChapterSelect)
        {
            if (index < StoryChapter.All.Count)
            {
                StoryChapter chapter = StoryChapter.All[index];
                if (_storyProgress.IsUnlocked(chapter.Number))
                {
                    StartGame(GameLaunchRequest.ForStory(chapter.Number));
                }
            }
            else
            {
                SetPage(ScreenPage.ModeSelect);
            }

            return;
        }

        if (_page == ScreenPage.RulesBasics)
        {
            SetPage(index == 0 ? ScreenPage.Menu : ScreenPage.RulesBoss);
            return;
        }

        if (index == 0)
        {
            SetPage(ScreenPage.RulesBasics);
        }
        else
        {
            SetPage(ScreenPage.ModeSelect);
        }
    }

    private void StartGame(GameLaunchRequest request)
    {
        _animationTimer.Stop();
        StartRequested?.Invoke(request);
    }

    private void ToggleMusic()
    {
        _audio.SetMusicEnabled(!_audio.MusicEnabled);
        _audio.PlayCue(SoundCue.MenuMove);
        Invalidate();
    }

    private void ToggleSoundEffects()
    {
        _audio.SetSoundEffectsEnabled(!_audio.SoundEffectsEnabled);
        _audio.PlayCue(SoundCue.MenuMove);
        Invalidate();
    }

    private void SetPage(ScreenPage page)
    {
        _page = page;
        _selectedButton = page is ScreenPage.RulesBasics or ScreenPage.RulesBoss ? 1 : 0;
        _hoveredButton = -1;
        Invalidate();
    }

    private void SelectButton(int index)
    {
        if (_selectedButton == index)
        {
            return;
        }

        _selectedButton = index;
        _audio.PlayCue(SoundCue.MenuMove);
        Invalidate();
    }

    private int HitTest(Point location)
    {
        MenuButton[] buttons = GetButtons();
        for (int i = 0; i < buttons.Length; i++)
        {
            if (buttons[i].Bounds.Contains(location))
            {
                return i;
            }
        }

        return -1;
    }

    private static string OnOff(bool enabled)
    {
        return enabled ? "ON" : "OFF";
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _animationTimer.Dispose();
            _titleFont.Dispose();
            _subtitleFont.Dispose();
            _buttonFont.Dispose();
            _sectionFont.Dispose();
            _bodyFont.Dispose();
            _smallFont.Dispose();
        }

        base.Dispose(disposing);
    }

    private readonly record struct MenuButton(Rectangle Bounds, string Label);

    private enum ScreenPage
    {
        Menu,
        ModeSelect,
        ChapterSelect,
        RulesBasics,
        RulesBoss
    }
}
