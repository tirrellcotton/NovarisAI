using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NovarisAI.Core.Configuration;
using NovarisAI.Core.Interfaces;
using NovarisAI.Core.Models;

namespace NovarisAI.Services;

public sealed class OllamaService(
    HttpClient httpClient,
    IOptions<OllamaOptions> options,
    ILogger<OllamaService> logger) : IOllamaService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly OllamaMessage SystemMessage = new()
    {
        Role = "system",
        Content =
            """
            You are a senior software development assistant.

            Preferred technologies:
            - C#
            - ASP.NET Core MVC
            - HTML
            - CSS
            - JavaScript
            - TypeScript
            - Bootstrap
            - SQL Server
            - PostgreSQL

            Testing preferences:
            - Use xUnit.
            - Use NSubstitute when mocking is necessary.

            Development conventions:
            - Do not introduce React unless explicitly requested.
            - Do not introduce Tailwind unless explicitly requested.
            - Do not introduce repository patterns unless explicitly requested.
            - Prefer clear, maintainable code over unnecessary abstraction.
            - Explain important architectural tradeoffs.
            """
    };

    public async Task<string> AskAsync(
        IReadOnlyCollection<OllamaMessage> messages,
        CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.PostAsJsonAsync(
            "api/chat",
            CreateRequest(messages, stream: false),
            cancellationToken);

        EnsureSuccess(response);

        var result = await response.Content.ReadFromJsonAsync<OllamaChatResponse>(
            cancellationToken: cancellationToken);

        return result?.Message.Content ?? "The model returned no response.";
    }

    public async IAsyncEnumerable<string> AskStreamAsync(
        IReadOnlyCollection<OllamaMessage> messages,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "api/chat")
        {
            Content = JsonContent.Create(CreateRequest(messages, stream: true))
        };

        using var response = await httpClient.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);

        EnsureSuccess(response);

        await using var responseStream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(responseStream);

        while (await reader.ReadLineAsync(cancellationToken) is { } line)
        {
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var result = JsonSerializer.Deserialize<OllamaChatResponse>(line, JsonOptions);

            if (!string.IsNullOrEmpty(result?.Message.Content))
            {
                yield return result.Message.Content;
            }
        }
    }

    private OllamaChatRequest CreateRequest(
        IReadOnlyCollection<OllamaMessage> messages,
        bool stream)
    {
        return new OllamaChatRequest
        {
            Model = options.Value.Model,
            Stream = stream,
            Messages = [SystemMessage, .. messages]
        };
    }

    private void EnsureSuccess(HttpResponseMessage response)
    {
        if (response.IsSuccessStatusCode)
        {
            return;
        }

        logger.LogError(
            "Ollama returned status code {StatusCode}",
            response.StatusCode);

        response.EnsureSuccessStatusCode();
    }
}
