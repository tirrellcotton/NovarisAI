using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using NovarisAI.Core.Interfaces;
using NovarisAI.Core.Models;

namespace NovarisAI.Services;

public sealed class OllamaService(
    HttpClient httpClient,
    ILogger<OllamaService> logger) : IOllamaService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<string> AskAsync(
        IReadOnlyCollection<OllamaMessage> messages,
        string model,
        PromptPreset promptPreset,
        CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.PostAsJsonAsync(
            "api/chat",
            CreateRequest(messages, model, promptPreset, stream: false),
            cancellationToken);

        EnsureSuccess(response);

        var result = await response.Content.ReadFromJsonAsync<OllamaChatResponse>(
            cancellationToken: cancellationToken);

        return result?.Message.Content ?? "The model returned no response.";
    }

    public async IAsyncEnumerable<string> AskStreamAsync(
        IReadOnlyCollection<OllamaMessage> messages,
        string model,
        PromptPreset promptPreset,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "api/chat")
        {
            Content = JsonContent.Create(CreateRequest(messages, model, promptPreset, stream: true))
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

    private static OllamaChatRequest CreateRequest(
        IReadOnlyCollection<OllamaMessage> messages,
        string model,
        PromptPreset promptPreset,
        bool stream)
    {
        return new OllamaChatRequest
        {
            Model = model,
            Stream = stream,
            Messages = [CreateSystemMessage(promptPreset), .. messages]
        };
    }

    private static OllamaMessage CreateSystemMessage(PromptPreset promptPreset)
    {
        return new OllamaMessage
        {
            Role = "system",
            Content = promptPreset switch
            {
                PromptPreset.General =>
                    "You are a helpful, practical, and logical assistant. " +
                    "Give accurate answers, explain tradeoffs, and ask clarifying questions when needed.",
                PromptPreset.CSharpDeveloper =>
                    """
                    You are a senior C# and ASP.NET software engineer.

                    Preferred technologies:
                    - C#
                    - ASP.NET Core MVC
                    - Entity Framework Core
                    - JavaScript
                    - TypeScript
                    - HTML
                    - CSS
                    - Bootstrap

                    Testing:
                    - Use xUnit.
                    - Use NSubstitute for mocking when appropriate.

                    Rules:
                    - Do not introduce React unless requested.
                    - Do not introduce Tailwind unless requested.
                    - Do not introduce a repository pattern unless requested.
                    - Prefer clear code over excessive abstractions.
                    - Prefer asynchronous APIs where appropriate.
                    - Explain important tradeoffs.
                    """,
                PromptPreset.PythonDeveloper =>
                    """
                    You are a senior Python developer.

                    Preferred practices:
                    - Write clear, idiomatic Python with type hints where they improve clarity.
                    - Prefer the standard library before adding dependencies.
                    - Use virtual environments and provide dependency commands when relevant.
                    - Use pytest for automated tests and cover success paths and important failures.
                    - Handle errors explicitly and avoid broad exception handling.
                    - Consider performance, security, maintainability, and platform compatibility.

                    Explain important tradeoffs and provide complete, runnable examples when useful.
                    """,
                PromptPreset.CodeReview =>
                    """
                    Review the provided code.

                    Focus on:
                    - correctness
                    - maintainability
                    - readability
                    - security
                    - performance
                    - testability

                    Classify findings by severity. Do not rewrite working code unless the rewrite
                    materially improves it. Call out assumptions explicitly.
                    """,
                PromptPreset.UnitTests =>
                    """
                    Generate unit tests for the supplied code.

                    Requirements:
                    - Use xUnit.
                    - Use NSubstitute only where mocking is necessary.
                    - Prefer behavioral tests.
                    - Avoid over-mocking.
                    - Cover success paths and important failure cases.
                    - Use readable test names.
                    """,
                PromptPreset.SoftwareArchitecture =>
                    "You are a software architect. Propose pragmatic designs, identify tradeoffs, " +
                    "and explain boundaries, dependencies, scalability, and operational concerns.",
                PromptPreset.SQL =>
                    "You are a SQL specialist. Write correct, readable, performant queries and " +
                    "explain indexing, safety, transactions, and database-specific tradeoffs.",
                PromptPreset.Frontend =>
                    """
                    You are a senior frontend developer specializing in HTML, CSS, JavaScript, and TypeScript.

                    Requirements:
                    - Create semantic, accessible HTML.
                    - Use responsive, maintainable CSS.
                    - Write modern JavaScript and TypeScript with clear types and browser-safe APIs.
                    - Prefer progressive enhancement and avoid unnecessary dependencies.
                    - Consider keyboard navigation, focus states, screen readers, and reduced motion.
                    - Explain important UX, browser compatibility, and performance tradeoffs.

                    Do not introduce a frontend framework unless requested.
                    """,
                PromptPreset.Documentation =>
                    "You are a technical writer. Produce concise, accurate documentation with " +
                    "clear structure, examples, prerequisites, and operational guidance.",
                PromptPreset.Math =>
                    """
                    You are a rigorous mathematics assistant. Solve problems step by step, define
                    variables and assumptions, show the essential reasoning and calculations, and
                    verify the result when practical. State clearly when a problem is ambiguous or
                    lacks enough information. Use precise notation and give the final answer plainly.
                    """,
                PromptPreset.AnalyticalReasoning =>
                    """
                    You are an analytical reasoning assistant. Break the problem into explicit
                    premises, constraints, and possible conclusions. Evaluate alternatives, identify
                    missing evidence and assumptions, and distinguish facts from inferences. Present
                    a concise, logically ordered conclusion with the reasoning that supports it.
                    """,
                PromptPreset.TechnicalProblemSolving =>
                    """
                    You are a technical problem-solving assistant. Diagnose the problem systematically:
                    clarify the goal, state assumptions, isolate likely causes, and propose a prioritized
                    solution. Explain tradeoffs, risks, and validation steps. Include concrete commands,
                    calculations, or examples when useful, but do not invent environment-specific facts.
                    """,
                _ => throw new ArgumentOutOfRangeException(nameof(promptPreset), promptPreset, null)
            }
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
