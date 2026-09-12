using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using NovarisAI.Web.Configuration;
using NovarisAI.Web.Models;

namespace NovarisAI.Web.Services;

/// <summary>
/// Represents a service for interacting with the Ollama chat API.
/// </summary>
/// <param name="httpClient">The HTTP client used to communicate with the Ollama chat API.</param>
public sealed class OllamaService(HttpClient httpClient,
    IOptions<OllamaOptions> options) : IOllamaService
{
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

        response.EnsureSuccessStatusCode();

        var result =
            await response.Content.ReadFromJsonAsync<OllamaChatResponse>(
                cancellationToken: cancellationToken);

        return result?.Message.Content
               ?? "The model returned no response.";
    }
}