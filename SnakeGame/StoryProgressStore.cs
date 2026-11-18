using System.Text.Json;

namespace SnakeGame;

internal sealed class StoryProgress
{
    public int Version { get; set; } = 1;

    public int HighestCompletedChapter { get; set; }

    public int HighestUnlockedChapter => Math.Max(1, HighestCompletedChapter + 1);

    public bool IsCompleted(int chapterNumber)
    {
        return chapterNumber <= HighestCompletedChapter;
    }

    public bool IsUnlocked(int chapterNumber)
    {
        return chapterNumber <= HighestUnlockedChapter;
    }

    public bool Complete(int chapterNumber)
    {
        if (chapterNumber <= HighestCompletedChapter)
        {
            return false;
        }

        HighestCompletedChapter = chapterNumber;
        return true;
    }
}

internal sealed class StoryProgressStore
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true
    };

    private readonly string _filePath;

    public StoryProgressStore(string? filePath = null)
    {
        _filePath = filePath ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "SnakeAdventures",
            "progress.json");
    }

    public StoryProgress Load()
    {
        try
        {
            if (!File.Exists(_filePath))
            {
                return new StoryProgress();
            }

            StoryProgress? progress = JsonSerializer.Deserialize<StoryProgress>(
                File.ReadAllText(_filePath),
                JsonOptions);
            if (progress is null)
            {
                return new StoryProgress();
            }

            progress.HighestCompletedChapter = Math.Max(0, progress.HighestCompletedChapter);
            return progress;
        }
        catch (Exception exception) when (
            exception is IOException or UnauthorizedAccessException or JsonException)
        {
            return new StoryProgress();
        }
    }

    public bool Save(StoryProgress progress)
    {
        try
        {
            string? directory = Path.GetDirectoryName(_filePath);
            if (!string.IsNullOrEmpty(directory))
            {
                Directory.CreateDirectory(directory);
            }

            string temporaryPath = $"{_filePath}.tmp";
            File.WriteAllText(temporaryPath, JsonSerializer.Serialize(progress, JsonOptions));
            File.Move(temporaryPath, _filePath, overwrite: true);
            return true;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            // Progress persistence should never prevent the game from continuing.
            return false;
        }
    }
}
