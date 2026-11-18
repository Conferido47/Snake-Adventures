using System.Text.Json;
using System.Text.RegularExpressions;
using System.Security.Cryptography;

namespace SnakeGame;

internal sealed record PlayerProfile(string DisplayName, string Token)
{
    private static string ProfilePath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "SnakeAdventures", "player-profile.json");

    public static bool IsValidName(string name) => name.Length is > 0 and <= 32 &&
        !Regex.IsMatch(name, @"[\p{Cc}\p{Cf}<>]");

    public static PlayerProfile? Load()
    {
        try
        {
            PlayerProfile? profile = JsonSerializer.Deserialize<PlayerProfile>(File.ReadAllText(ProfilePath));
            return profile is not null && profile.DisplayName is not null && IsValidName(profile.DisplayName) &&
                profile.Token is not null && Regex.IsMatch(profile.Token, "^[0-9a-f]{64}$") ? profile : null;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or JsonException)
        {
            return null;
        }
    }

    public static PlayerProfile Create(string name, PlayerProfile? previous) =>
        new(name, previous?.Token ?? Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant());

    public bool Save()
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(ProfilePath)!);
            File.WriteAllText(ProfilePath, JsonSerializer.Serialize(this));
            return true;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }
}

internal sealed class PlayerNameDialog : Form
{
    public PlayerProfile? Profile { get; private set; }

    public PlayerNameDialog()
    {
        Text = "Snake Adventures — Who's playing?";
        ClientSize = new Size(460, 330);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        StartPosition = FormStartPosition.CenterScreen;
        MaximizeBox = false;
        MinimizeBox = false;
        AutoScaleMode = AutoScaleMode.Dpi;
        Font = new Font("Segoe UI", 10);
        PlayerProfile? saved = PlayerProfile.Load();
        Label intro = new() { Text = "Choose a display name (not necessarily your real name):", AutoSize = true, Location = new Point(20, 20) };
        TextBox name = new() { Text = saved?.DisplayName ?? "", MaxLength = 32, Location = new Point(20, 55), Width = 420, TabIndex = 0, AccessibleName = "Player name" };
        Label details = new() { Text = "Your name, platform, visits, and completed scores will be saved for the game creators' private player dashboard. This is not a verified account.\n\nYour name is remembered on this PC. You can change it here next time.", Location = new Point(20, 100), Size = new Size(420, 115) };
        LinkLabel privacy = new() { Text = "Privacy details", Location = new Point(20, 218), AutoSize = true };
        privacy.LinkClicked += (_, _) => System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(
            "https://snake-adventures-discord.pages.dev/privacy/") { UseShellExecute = true });
        Label error = new() { ForeColor = Color.DarkRed, Location = new Point(20, 245), Size = new Size(420, 25) };
        Button play = new() { Text = "Play and save results", Location = new Point(20, 280), Size = new Size(205, 32), TabIndex = 1 };
        Button offline = new() { Text = "Play offline", DialogResult = DialogResult.Cancel, Location = new Point(240, 280), Size = new Size(200, 32), TabIndex = 2 };
        play.Click += (_, _) =>
        {
            string displayName = name.Text.Trim().Normalize();
            if (!PlayerProfile.IsValidName(displayName))
            {
                error.Text = "Use 1–32 characters without control characters or < >.";
                return;
            }
            Profile = PlayerProfile.Create(displayName, saved);
            if (!Profile.Save()) MessageBox.Show(this, "Your name will only be remembered for this session.", "Snake Adventures");
            DialogResult = DialogResult.OK;
        };
        Controls.AddRange([intro, name, details, privacy, error, play, offline]);
        AcceptButton = play;
        CancelButton = offline;
        Shown += (_, _) => name.Focus();
    }
}
