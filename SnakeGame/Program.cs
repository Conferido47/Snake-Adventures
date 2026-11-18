namespace SnakeGame;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        using PlayerNameDialog playerDialog = new();
        PlayerProfile? profile = playerDialog.ShowDialog() == DialogResult.OK ? playerDialog.Profile : null;
        Application.Run(new GameForm(profile));
    }
}
