using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NovarisAI.Core.Configuration;
using NovarisAI.Core.Models;
using NovarisAI.Core.Interfaces;

namespace NovarisAI.Services;

/// <summary>
/// Represents a service for interacting with the Ollama chat API.
/// </summary>
/// <param name="httpClient">The HTTP client used to communicate with the Ollama chat API.</param>
public sealed class OllamaService(HttpClient httpClient,
    IOptions<OllamaOptions> options,
    ILogger<OllamaService> logger) : IOllamaService
{
    private static readonly System.Text.Json.JsonSerializerOptions JsonOptions =
        new(System.Text.Json.JsonSerializerDefaults.Web);

    /// <summary>
    /// Asks a question to the Ollama chat API and returns the response.
    /// </summary>
    /// <param name="prompt">The question to ask the Ollama chat API.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The response from the Ollama chat API.</returns>
    public async Task<string> AskAsync(string prompt, CancellationToken cancellationToken = default)
    {
        var request = new OllamaChatRequest
        {
            Model = options.Value.Model,
            Stream = false,
            Messages =
            [
                new OllamaMessage
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
                },
                new OllamaMessage
                {
                    Role = "user",
                    Content = prompt
                }
            ]
        };

        using var response = await httpClient.PostAsJsonAsync(
            "api/chat",
            request,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            logger.LogError(
                "Ollama returned status code {StatusCode}",
                response.StatusCode);

            response.EnsureSuccessStatusCode();
        }

        var result =
            await response.Content.ReadFromJsonAsync<OllamaChatResponse>(
                cancellationToken: cancellationToken);

        return result?.Message.Content
               ?? "The model returned no response.";
    }

    public async IAsyncEnumerable<string> AskStreamAsync(
        string prompt,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var streamRequest = new OllamaChatRequest
        {
            Model = options.Value.Model,
            Stream = true,
            Messages =
            [
                new OllamaMessage
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
                },
                new OllamaMessage
                {
                    Role = "user",
                    Content = prompt
                }
            ]
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "api/chat")
        {
            Content = JsonContent.Create(streamRequest)
        };

        using var response = await httpClient.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            logger.LogError(
                "Ollama returned status code {StatusCode}",
                response.StatusCode);

            response.EnsureSuccessStatusCode();
        }

        await using var responseStream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(responseStream);

        while (await reader.ReadLineAsync(cancellationToken) is { } line)
        {
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var result = System.Text.Json.JsonSerializer.Deserialize<OllamaChatResponse>(
                line,
                JsonOptions);

            if (!string.IsNullOrEmpty(result?.Message.Content))
            {
                yield return result.Message.Content;
            }
        }
    }
}
