using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace SnakeGame;

internal sealed class PlayerReporter(PlayerProfile profile)
{
    private static readonly HttpClient Client = new(new HttpClientHandler { AllowAutoRedirect = false })
    {
        Timeout = TimeSpan.FromSeconds(8)
    };
    private readonly string _sessionId = Guid.NewGuid().ToString();

    public Task<bool> ReportVisitAsync() => SendAsync(null);

    public Task<bool> ReportRunAsync(int score, int level, bool won) => SendAsync(new
    {
        submissionId = Guid.NewGuid().ToString(), score, level, won, gameVersion = "1.0.1"
    });

    private async Task<bool> SendAsync(object? run)
    {
        Dictionary<string, object> payload = new()
        {
            ["displayName"] = profile.DisplayName,
            ["platform"] = "windows",
            ["gameVersion"] = "1.0.1",
            ["sessionId"] = _sessionId
        };
        if (run is not null) payload["run"] = run;
        for (int attempt = 0; attempt < 2; attempt++)
        {
            try
            {
                using HttpRequestMessage request = new(HttpMethod.Post,
                    "https://snake-adventures-discord.pages.dev/api/play");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", profile.Token);
                request.Content = JsonContent.Create(payload);
                using HttpResponseMessage response = await Client.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    JsonElement result = await response.Content.ReadFromJsonAsync<JsonElement>();
                    return result.ValueKind == JsonValueKind.Object && result.TryGetProperty("stored", out JsonElement stored) &&
                        stored.ValueKind == JsonValueKind.True;
                }
                if ((int)response.StatusCode < 500 && (int)response.StatusCode != 429) return false;
            }
            catch (Exception error) when (error is HttpRequestException or OperationCanceledException or JsonException)
            {
                // Reporting must never prevent local play when the network is unavailable.
            }
            if (attempt == 0) await Task.Delay(5100);
        }
        return false;
    }
}
