namespace SnakeGame;

internal enum GameMode
{
    Endless,
    Story
}

internal readonly record struct GameLaunchRequest(GameMode Mode, int ChapterNumber)
{
    public static GameLaunchRequest Endless => new(GameMode.Endless, 0);

    public static GameLaunchRequest ForStory(int chapterNumber)
    {
        return new GameLaunchRequest(GameMode.Story, chapterNumber);
    }
}

internal sealed record StoryChapter(
    int Number,
    string Title,
    string IntroText,
    string Objective,
    string CompletionText,
    int BossScoreTarget)
{
    private static readonly StoryChapter[] Chapters =
    {
        new(
            1,
            "THE HOLLOW WOOD",
            "Wren guards the road. Gather strength and break the first seal.",
            "Reach 500 points, then bind the Hollow King.",
            "The first seal is broken. The path beyond the wood is open.",
            500)
    };

    public static IReadOnlyList<StoryChapter> All => Chapters;

    public static StoryChapter Get(int chapterNumber)
    {
        return Find(chapterNumber) ??
               throw new ArgumentOutOfRangeException(
                   nameof(chapterNumber),
                   chapterNumber,
                   "Unknown story chapter.");
    }

    public static StoryChapter? Find(int chapterNumber)
    {
        return Array.Find(Chapters, chapter => chapter.Number == chapterNumber);
    }
}
