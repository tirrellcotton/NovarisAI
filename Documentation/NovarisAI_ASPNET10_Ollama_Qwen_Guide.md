# Building a Local AI Coding Assistant with ASP.NET Core 10, C#, Ollama, and Qwen2.5-Coder 14B

## Overview

This guide walks through building a local AI coding assistant using:

- **ASP.NET Core MVC on .NET 10**
- **C#**
- **Ollama**
- **Qwen2.5-Coder 14B**
- **Razor Views**
- **Bootstrap**
- **HttpClientFactory**

The application will run entirely on your local Windows machine and send prompts to a locally hosted Qwen model through Ollama.

The initial architecture is intentionally simple:

```text
Browser
   |
   v
ASP.NET Core MVC (.NET 10)
   |
   v
Ollama HTTP API
http://localhost:11434
   |
   v
Qwen2.5-Coder 14B
```

The goal is to first build a clean, understandable local AI application without introducing unnecessary architecture. Once the basic version works, the guide shows how to extend it with conversation history, streaming, Markdown rendering, model selection, prompt presets, file context, and more.

---

# 1. Prerequisites

Before creating the application, install the following.

## 1.1 .NET 10 SDK

Verify your installed SDK:

```powershell
dotnet --version
```

You should see a version beginning with:

```text
10.
```

You can also list all installed SDKs:

```powershell
dotnet --list-sdks
```

---

## 1.2 Visual Studio or Rider

For Visual Studio, install the workload:

```text
ASP.NET and web development
```

Rider also works well with this project.

---

## 1.3 Install Ollama

Install Ollama for Windows.

After installation, verify it from PowerShell:

```powershell
ollama --version
```

If the command is not found, close and reopen your terminal before trying again.

---

## 1.4 Download Qwen2.5-Coder 14B

Pull the model:

```powershell
ollama pull qwen2.5-coder:14b
```

After the download completes, verify it:

```powershell
ollama list
```

You should see an entry similar to:

```text
qwen2.5-coder:14b
```

---

## 1.5 Test Qwen Before Writing Any Code

Run the model directly:

```powershell
ollama run qwen2.5-coder:14b
```

Then enter a simple prompt:

```text
Write a C# method that determines whether an integer is prime.
```

If Qwen answers correctly, your local model stack is working.

Exit the interactive Ollama session when finished.

---

# 2. Create the ASP.NET Core MVC Project

Create a development directory if you do not already have one.

For example:

```powershell
mkdir C:\Dev
cd C:\Dev
```

Create the project:

```powershell
dotnet new mvc -n NovarisAI
cd NovarisAI
```

Run the application:

```powershell
dotnet run
```

The terminal will show a localhost URL such as:

```text
https://localhost:7001
```

Open that address in your browser.

At this point, you should see the standard ASP.NET Core MVC template.

Stop the application with:

```text
Ctrl+C
```

---

# 3. Understand the Initial Project Structure

The MVC template creates a structure similar to:

```text
NovarisAI
|
+-- Controllers
|   +-- HomeController.cs
|
+-- Models
|   +-- ErrorViewModel.cs
|
+-- Views
|   +-- Home
|   +-- Shared
|
+-- wwwroot
|   +-- css
|   +-- js
|   +-- lib
|
+-- appsettings.json
+-- Program.cs
+-- NovarisAI.csproj
```

We will add:

```text
Configuration
Services
Models specific to Ollama
ChatController
Chat view
```

---

# 4. Create the Ollama Request Models

Create this file:

```text
Models/OllamaChatRequest.cs
```

Add:

```csharp
namespace NovarisAI.Models;

public sealed class OllamaChatRequest
{
    public string Model { get; set; } = "qwen2.5-coder:14b";

    public List<OllamaMessage> Messages { get; set; } = [];

    public bool Stream { get; set; }
}

public sealed class OllamaMessage
{
    public string Role { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;
}
```

This model represents the JSON payload sent to Ollama.

A request will look conceptually like this:

```json
{
  "model": "qwen2.5-coder:14b",
  "messages": [
    {
      "role": "system",
      "content": "You are a senior software development assistant."
    },
    {
      "role": "user",
      "content": "Explain dependency injection in ASP.NET Core."
    }
  ],
  "stream": false
}
```

---

# 5. Create the Ollama Response Model

Create:

```text
Models/OllamaChatResponse.cs
```

Add:

```csharp
namespace NovarisAI.Models;

public sealed class OllamaChatResponse
{
    public string Model { get; set; } = string.Empty;

    public OllamaMessage Message { get; set; } = new();

    public bool Done { get; set; }
}
```

The important value is:

```csharp
response.Message.Content
```

That contains the generated answer.

---

# 6. Create the Chat View Model

The MVC view should not work directly with low-level Ollama transport objects.

Create:

```text
Models/ChatViewModel.cs
```

Add:

```csharp
using System.ComponentModel.DataAnnotations;

namespace NovarisAI.Models;

public sealed class ChatViewModel
{
    [Required]
    [Display(Name = "Ask Qwen")]
    public string Prompt { get; set; } = string.Empty;

    public string? Response { get; set; }
}
```

This keeps the UI model separate from the API contract.

---

# 7. Create an Ollama Service Interface

Create a new directory:

```text
Services
```

Create:

```text
Services/IOllamaService.cs
```

Add:

```csharp
namespace NovarisAI.Services;

public interface IOllamaService
{
    Task<string> AskAsync(
        string prompt,
        CancellationToken cancellationToken = default);
}
```

This keeps the controller from knowing the details of the Ollama HTTP API.

---

# 8. Create the Ollama Service Implementation

Create:

```text
Services/OllamaService.cs
```

Add:

```csharp
using System.Net.Http.Json;
using NovarisAI.Models;

namespace NovarisAI.Services;

public sealed class OllamaService(HttpClient httpClient)
    : IOllamaService
{
    public async Task<string> AskAsync(
        string prompt,
        CancellationToken cancellationToken = default)
    {
        var request = new OllamaChatRequest
        {
            Model = "qwen2.5-coder:14b",
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
            "/api/chat",
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
```

This service performs four jobs:

1. Builds the Ollama chat request.
2. Sends the request to the local Ollama API.
3. Deserializes the response.
4. Returns only the generated text to the controller.

---

# 9. Register the Ollama Service

Open:

```text
Program.cs
```

Add:

```csharp
using NovarisAI.Services;
```

Then register the typed HTTP client before:

```csharp
var app = builder.Build();
```

Use:

```csharp
builder.Services.AddHttpClient<IOllamaService, OllamaService>(client =>
{
    client.BaseAddress = new Uri("http://localhost:11434");
    client.Timeout = TimeSpan.FromMinutes(5);
});
```

The top of your file should look similar to:

```csharp
using NovarisAI.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();

builder.Services.AddHttpClient<IOllamaService, OllamaService>(client =>
{
    client.BaseAddress = new Uri("http://localhost:11434");
    client.Timeout = TimeSpan.FromMinutes(5);
});

var app = builder.Build();
```

Using `IHttpClientFactory` is preferable to creating `HttpClient` manually throughout the application.

---

# 10. Create the Chat Controller

Create:

```text
Controllers/ChatController.cs
```

Add:

```csharp
using Microsoft.AspNetCore.Mvc;
using NovarisAI.Models;
using NovarisAI.Services;

namespace NovarisAI.Controllers;

public sealed class ChatController(IOllamaService ollamaService)
    : Controller
{
    [HttpGet]
    public IActionResult Index()
    {
        return View(new ChatViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Index(
        ChatViewModel model,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        try
        {
            model.Response = await ollamaService.AskAsync(
                model.Prompt,
                cancellationToken);
        }
        catch (HttpRequestException)
        {
            ModelState.AddModelError(
                string.Empty,
                "Unable to connect to Ollama. Verify that Ollama is running.");
        }

        return View(model);
    }
}
```

This controller uses:

- dependency injection
- asynchronous execution
- anti-forgery validation
- model validation
- a cancellation token
- basic connection-error handling

---

# 11. Create the Chat View

Create the directory:

```text
Views/Chat
```

Create:

```text
Views/Chat/Index.cshtml
```

Add:

```html
@model NovarisAI.Models.ChatViewModel

@{
    ViewData["Title"] = "Novaris AI";
}

<div class="container py-4">

    <div class="row justify-content-center">
        <div class="col-xl-10">

            <h1 class="mb-3">Novaris AI</h1>

            <p class="text-muted">
                Local coding assistant powered by Qwen2.5-Coder 14B.
            </p>

            <form asp-action="Index"
                  asp-controller="Chat"
                  method="post">

                <div asp-validation-summary="ModelOnly"
                     class="text-danger">
                </div>

                <div class="mb-3">
                    <label asp-for="Prompt"
                           class="form-label">
                    </label>

                    <textarea asp-for="Prompt"
                              class="form-control"
                              rows="8"
                              placeholder="Ask a programming question...">
                    </textarea>

                    <span asp-validation-for="Prompt"
                          class="text-danger">
                    </span>
                </div>

                <button type="submit"
                        class="btn btn-primary">
                    Ask Qwen
                </button>

            </form>

            @if (!string.IsNullOrWhiteSpace(Model.Response))
            {
                <hr class="my-4" />

                <h2 class="h4">Response</h2>

                <pre class="response-box"><code>@Model.Response</code></pre>
            }

        </div>
    </div>

</div>
```

---

# 12. Add CSS for the Response Area

Open:

```text
wwwroot/css/site.css
```

Add:

```css
.response-box {
    white-space: pre-wrap;
    word-wrap: break-word;
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 0.5rem;
    padding: 1rem;
    max-height: 40rem;
    overflow-y: auto;
}

textarea {
    font-family: Consolas, "Courier New", monospace;
}
```

This preserves generated formatting while allowing long responses to wrap and scroll.

---

# 13. Add a Navigation Link

Open:

```text
Views/Shared/_Layout.cshtml
```

Find the navigation list and add:

```html
<li class="nav-item">
    <a class="nav-link text-dark"
       asp-controller="Chat"
       asp-action="Index">
        Novaris AI
    </a>
</li>
```

---

# 14. Run the Application

Verify the model is installed:

```powershell
ollama list
```

Then start the ASP.NET application:

```powershell
dotnet run
```

Open:

```text
https://localhost:<port>/Chat
```

Try this prompt:

```text
Create an ASP.NET Core MVC controller and Razor view for displaying
a list of customers.

Requirements:
- Use C#.
- Use Entity Framework Core.
- Use async database access.
- Use Bootstrap.
- Do not use the repository pattern.
- Include xUnit tests using NSubstitute only when mocking is appropriate.
- Explain your design decisions.
```

The request path is:

```text
Browser
   |
   v
ChatController
   |
   v
IOllamaService
   |
   v
OllamaService
   |
   v
http://localhost:11434/api/chat
   |
   v
Qwen2.5-Coder 14B
   |
   v
Razor View
```

---

# 15. Move Ollama Configuration Into appsettings.json

The model name and base URL should not remain hard-coded.

Update:

```text
appsettings.json
```

A complete example:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "Ollama": {
    "BaseUrl": "http://localhost:11434",
    "Model": "qwen2.5-coder:14b"
  }
}
```

---

# 16. Create a Strongly Typed Options Class

Create:

```text
Configuration/OllamaOptions.cs
```

Add:

```csharp
namespace NovarisAI.Configuration;

public sealed class OllamaOptions
{
    public const string SectionName = "Ollama";

    public string BaseUrl { get; set; } = string.Empty;

    public string Model { get; set; } = string.Empty;
}
```

---

# 17. Register Ollama Options

Update `Program.cs`:

```csharp
using NovarisAI.Configuration;
using NovarisAI.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();

builder.Services.Configure<OllamaOptions>(
    builder.Configuration.GetSection(OllamaOptions.SectionName));

builder.Services.AddHttpClient<IOllamaService, OllamaService>((serviceProvider, client) =>
{
    var configuration =
        serviceProvider.GetRequiredService<IConfiguration>();

    var baseUrl =
        configuration["Ollama:BaseUrl"]
        ?? "http://localhost:11434";

    client.BaseAddress = new Uri(baseUrl);
    client.Timeout = TimeSpan.FromMinutes(5);
});

var app = builder.Build();
```

---

# 18. Read the Model Name Through IOptions

Update `OllamaService.cs`:

```csharp
using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using NovarisAI.Configuration;
using NovarisAI.Models;

namespace NovarisAI.Services;

public sealed class OllamaService(
    HttpClient httpClient,
    IOptions<OllamaOptions> options)
    : IOllamaService
{
    private readonly OllamaOptions _options = options.Value;

    public async Task<string> AskAsync(
        string prompt,
        CancellationToken cancellationToken = default)
    {
        var request = new OllamaChatRequest
        {
            Model = _options.Model,
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

                        Testing:
                        - Prefer xUnit.
                        - Prefer NSubstitute when mocking is necessary.

                        Rules:
                        - Do not introduce React unless requested.
                        - Do not introduce Tailwind unless requested.
                        - Do not introduce repository patterns unless requested.
                        - Prefer clear, maintainable code.
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
            "/api/chat",
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
```

Now switching models requires only a configuration change.

---

# 19. Improve Error Handling

The local Ollama service might fail because:

- Ollama is not running
- the model has not been downloaded
- the model takes too long to load
- the machine is under memory pressure
- the request is canceled
- malformed data is returned

You can expand the controller:

```csharp
try
{
    model.Response = await ollamaService.AskAsync(
        model.Prompt,
        cancellationToken);
}
catch (TaskCanceledException)
{
    ModelState.AddModelError(
        string.Empty,
        "The request was canceled or timed out.");
}
catch (HttpRequestException ex)
{
    ModelState.AddModelError(
        string.Empty,
        $"Unable to communicate with Ollama: {ex.Message}");
}
catch (Exception)
{
    ModelState.AddModelError(
        string.Empty,
        "An unexpected error occurred.");
}
```

For production software, log the actual exception rather than exposing low-level error details to the user.

---

# 20. Add Logging

Inject `ILogger<OllamaService>`:

```csharp
public sealed class OllamaService(
    HttpClient httpClient,
    IOptions<OllamaOptions> options,
    ILogger<OllamaService> logger)
    : IOllamaService
```

Then log failures:

```csharp
logger.LogError(
    "Ollama returned status code {StatusCode}",
    response.StatusCode);
```

Logging becomes more valuable as you add streaming, file context, and tool execution.

---

# 21. Phase 2: Add Conversation History

The first version treats each question independently.

Current behavior:

```text
Prompt
  |
  v
Qwen
  |
  v
Answer
```

A true conversation needs to preserve earlier messages:

```text
System
User
Assistant
User
Assistant
User
```

A simple model could be:

```csharp
public sealed class ChatMessageViewModel
{
    public string Role { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;
}
```

Then your main view model could contain:

```csharp
public List<ChatMessageViewModel> Messages { get; set; } = [];
```

---

# 22. Choose a Conversation Storage Strategy

For a simple local app, you have several options.

## Option A: Session

Good for experimentation.

Advantages:

- easy to implement
- no database
- conversation follows the browser session

Disadvantages:

- not durable
- messages disappear after session expiration

## Option B: SQLite

Good for a more permanent local assistant.

Advantages:

- local
- lightweight
- easy to back up
- supports multiple conversations

Disadvantages:

- requires persistence code

## Option C: Browser Storage

Potential options:

- `localStorage`
- `sessionStorage`

For the first enhanced version, SQLite is probably the cleanest long-term approach.

---

# 23. Phase 3: Add Streaming Responses

The first implementation uses:

```csharp
Stream = false
```

This waits for the entire answer before returning it.

A better chat experience streams generated content as it arrives.

Conceptual flow:

```text
Qwen
  |
  v
Ollama streamed JSON
  |
  v
ASP.NET Core endpoint
  |
  v
Browser JavaScript
  |
  v
Tokens appear incrementally
```

Possible browser-side strategies include:

- Fetch streaming
- Server-Sent Events
- SignalR

For a single-user local app, Fetch streaming or Server-Sent Events is usually sufficient.

Do not start with SignalR unless you actually need bidirectional real-time communication.

---

# 24. Phase 4: Add Markdown Rendering

Coding models frequently return fenced code blocks.

Install Markdig:

```powershell
dotnet add package Markdig
```

A basic conversion looks like:

```csharp
using Markdig;

var html = Markdown.ToHtml(markdown);
```

Important security rule:

> Do not blindly trust generated HTML.

If HTML is rendered directly using `Html.Raw`, sanitize it first.

---

# 25. Add Syntax Highlighting

For a better coding experience, add a client-side syntax highlighter such as:

- Prism.js
- highlight.js

You can keep Bootstrap for layout while using dedicated CSS for code blocks.

---

# 26. Phase 5: Add Model Selection

Install additional models:

```powershell
ollama pull qwen2.5-coder:7b
ollama pull gemma3:12b
ollama pull phi4
```

Then add:

```csharp
public string SelectedModel { get; set; } =
    "qwen2.5-coder:14b";
```

And add a dropdown:

```html
<select asp-for="SelectedModel"
        class="form-select">

    <option value="qwen2.5-coder:7b">
        Qwen Coder 7B - Fast Coding
    </option>

    <option value="qwen2.5-coder:14b">
        Qwen Coder 14B - Main Coding Model
    </option>

    <option value="gemma3:12b">
        Gemma 3 12B - General Assistant
    </option>

    <option value="phi4">
        Phi-4 - Technical Reasoning
    </option>

</select>
```

Your service can then accept the model as a parameter.

---

# 27. Phase 6: Add Prompt Presets

Instead of one fixed system prompt, create presets.

Suggested presets:

```text
General
C# Developer
Code Review
Unit Tests
Software Architecture
SQL
Frontend
Documentation
```

Example:

```csharp
public enum PromptPreset
{
    General,
    CSharpDeveloper,
    CodeReview,
    UnitTests,
    SoftwareArchitecture,
    Sql,
    Frontend
}
```

---

# 28. Example C# Developer Prompt

```text
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
```

---

# 29. Example Code Review Prompt

```text
Review the provided code.

Focus on:
- correctness
- maintainability
- readability
- security
- performance
- testability

Classify findings by severity.

Do not rewrite working code unless the rewrite materially improves it.

Call out assumptions explicitly.
```

---

# 30. Example Unit Test Prompt

```text
Generate unit tests for the supplied code.

Requirements:
- Use xUnit.
- Use NSubstitute only where mocking is necessary.
- Prefer behavioral tests.
- Avoid over-mocking.
- Cover success paths and important failure cases.
- Use readable test names.
```

---

# 31. Phase 7: Add Source-Code Input

A coding assistant becomes more useful when it can receive files.

Start with simple text input:

```html
<textarea name="SourceCode"
          class="form-control"
          rows="20">
</textarea>
```

Then include the code in the user prompt.

Example:

```text
Review this C# code:

--- BEGIN SOURCE ---

{source code here}

--- END SOURCE ---
```

---

# 32. Add File Uploads Later

Use `IFormFile` in the controller.

Initially support only text-based source files such as:

```text
.cs
.cshtml
.html
.css
.js
.ts
.json
.sql
.md
```

Validate:

- file extension
- maximum size
- encoding
- expected text content

Do not automatically execute uploaded code.

---

# 33. Phase 8: Add Repository-Aware Context

A more advanced local coding assistant can inspect project files.

A safe first approach is to let the user choose a project directory explicitly.

Then:

1. scan supported files
2. ignore generated directories
3. extract relevant text
4. send only selected context to the model

Ignore directories such as:

```text
bin
obj
node_modules
.git
.vs
.idea
```

Do not dump an entire large repository into every prompt.

---

# 34. Add Context Selection

Better architecture:

```text
User question
   |
   v
Context selector
   |
   +--> matching source files
   +--> project instructions
   +--> architecture notes
   |
   v
Prompt builder
   |
   v
Ollama
```

This is the beginning of retrieval-augmented generation.

---

# 35. Phase 9: Add Local RAG

RAG means:

```text
Retrieve relevant information
           +
         Prompt
           |
           v
          LLM
```

Useful indexed content might include:

- source code
- architecture documentation
- README files
- coding standards
- API documentation
- database notes
- project-specific instructions

A simple RAG architecture is:

```text
Project files
    |
    v
Chunking
    |
    v
Embeddings
    |
    v
Vector store
    |
    v
Relevant chunks
    |
    v
Qwen prompt
```

Do not add RAG until the normal chat path is stable.

---

# 36. Phase 10: Add Tool Calling

Eventually the model could request safe local operations.

Possible tools:

```text
Search files
Read a source file
Run dotnet build
Run unit tests
Inspect git diff
Search project symbols
Query a local database schema
```

Important design rule:

> The model should request an action. Your application should decide whether that action is permitted.

Never give the model unrestricted shell execution by default.

---

# 37. Add a Tool Abstraction

A tool could be represented as:

```csharp
public interface ILocalTool
{
    string Name { get; }

    Task<string> ExecuteAsync(
        string input,
        CancellationToken cancellationToken);
}
```

Then implement controlled tools such as:

```text
ReadFileTool
SearchFilesTool
DotNetBuildTool
DotNetTestTool
GitDiffTool
```

Each tool should validate its input.

---

# 38. Security Considerations

Even though the model is local, still treat it as untrusted input and output.

## Do not expose secrets

Avoid sending:

- passwords
- API keys
- connection-string credentials
- private certificates
- SSH private keys
- access tokens

## Do not execute generated shell commands automatically

Generated commands should always be reviewed before execution.

## Sanitize rendered Markdown

Model-generated Markdown can contain HTML.

Sanitize before rendering.

## Validate uploaded files

Do not trust:

- extensions
- file names
- paths
- MIME types

---

# 39. Performance Tips for a 32 GB Laptop

Qwen2.5-Coder 14B is a good size for a 32 GB machine.

Recommended operating habits:

- avoid loading several large models at once
- close unused models
- monitor RAM usage
- keep browser tab counts reasonable during large prompts
- avoid huge context windows unless needed
- start with moderate prompt sizes
- use the 7B model for fast lightweight work
- use the 14B model when deeper coding reasoning is required

Check loaded models:

```powershell
ollama ps
```

Stop a model:

```powershell
ollama stop qwen2.5-coder:14b
```

---

# 40. Suggested Development Roadmap

## Phase 1 - Working Chat

Implement:

- MVC project
- Ollama service
- Qwen2.5-Coder 14B
- one prompt
- one response
- basic error handling

Do not continue until this works reliably.

## Phase 2 - Conversation History

Implement:

- message list
- user/assistant roles
- persistent conversation state

## Phase 3 - Streaming

Implement:

- streamed Ollama responses
- incremental browser rendering
- cancel generation button

## Phase 4 - Rich Output

Implement:

- Markdown
- syntax highlighting
- copy-code buttons
- code-block formatting

## Phase 5 - Model Selection

Implement:

- Qwen 7B
- Qwen 14B
- Gemma 12B
- Phi-4
- user-selectable model

## Phase 6 - Developer Presets

Implement:

- C# Developer
- Code Review
- Unit Tests
- Architecture
- SQL
- Frontend

## Phase 7 - Source Context

Implement:

- pasted code
- source file upload
- project file selection

## Phase 8 - Repository Awareness

Implement:

- folder scanning
- relevant file retrieval
- project instructions
- project metadata

## Phase 9 - RAG

Implement:

- embeddings
- vector search
- relevant document retrieval

## Phase 10 - Controlled Tools

Implement:

- file search
- file read
- git diff
- dotnet build
- dotnet test

---

# 41. Recommended Final Project Structure

A mature version might look like:

```text
NovarisAI
|
+-- Configuration
|   +-- OllamaOptions.cs
|
+-- Controllers
|   +-- ChatController.cs
|
+-- Models
|   +-- ChatViewModel.cs
|   +-- ChatMessageViewModel.cs
|   +-- OllamaChatRequest.cs
|   +-- OllamaChatResponse.cs
|
+-- Services
|   +-- IOllamaService.cs
|   +-- OllamaService.cs
|   +-- IPromptService.cs
|   +-- PromptService.cs
|
+-- Prompts
|   +-- CSharpDeveloperPrompt.cs
|   +-- CodeReviewPrompt.cs
|   +-- UnitTestPrompt.cs
|
+-- Tools
|   +-- ILocalTool.cs
|   +-- ReadFileTool.cs
|   +-- SearchFilesTool.cs
|   +-- DotNetBuildTool.cs
|   +-- DotNetTestTool.cs
|
+-- Views
|   +-- Chat
|   |   +-- Index.cshtml
|   |
|   +-- Shared
|       +-- _Layout.cshtml
|
+-- wwwroot
|   +-- css
|   +-- js
|
+-- appsettings.json
+-- Program.cs
+-- NovarisAI.csproj
```

Do not build this entire structure on day one.

Let the architecture grow only as the application gains real requirements.

---

# 42. What Not to Add Initially

Avoid introducing the following until a real need exists:

- Clean Architecture
- CQRS
- MediatR
- repository pattern
- microservices
- message queues
- Kubernetes
- complex domain layers
- unnecessary interfaces
- distributed caching
- cloud dependencies

For this local tool, simple is better.

---

# 43. A Good First Test Prompt

After Phase 1 works, use:

```text
Create an ASP.NET Core 10 MVC example that displays a list of customers.

Requirements:
- C#
- Entity Framework Core
- async database access
- Bootstrap
- semantic HTML
- no repository pattern
- include xUnit tests
- use NSubstitute only when mocking is actually necessary
- explain your architectural choices
```

Then evaluate:

- correctness
- response speed
- C# quality
- whether it follows your development rules
- memory use
- whether 14B feels responsive enough

---

# 44. Useful Ollama Commands

List installed models:

```powershell
ollama list
```

Run Qwen:

```powershell
ollama run qwen2.5-coder:14b
```

Run the smaller Qwen model:

```powershell
ollama run qwen2.5-coder:7b
```

Show active models:

```powershell
ollama ps
```

Stop Qwen:

```powershell
ollama stop qwen2.5-coder:14b
```

Remove a model:

```powershell
ollama rm qwen2.5-coder:14b
```

---

# 45. Final Architecture Direction

The long-term goal can evolve into:

```text
Browser
   |
   v
ASP.NET Core MVC
   |
   +--> Conversation Service
   |
   +--> Prompt Presets
   |
   +--> Repository Context
   |
   +--> Local RAG
   |
   +--> Controlled Tools
   |
   v
AI Service Abstraction
   |
   +--> Ollama
   |      |
   |      +--> Qwen2.5-Coder 7B
   |      +--> Qwen2.5-Coder 14B
   |      +--> Gemma 3 12B
   |      +--> Phi-4
   |
   +--> Optional future providers
```

The key design principle is to make the first version easy to understand.

Once the basic HTTP path is working, each later capability can be introduced deliberately and tested independently.

---

# 46. Recommended Next Step

Build only these pieces first:

1. Install Ollama.
2. Pull Qwen2.5-Coder 14B.
3. Verify the model runs locally.
4. Create the .NET 10 MVC project.
5. Add the Ollama request and response models.
6. Add `IOllamaService`.
7. Add `OllamaService`.
8. Register the typed `HttpClient`.
9. Add `ChatController`.
10. Add the Razor view.
11. Submit one prompt.
12. Verify the generated answer appears in the browser.

Once those twelve steps work reliably, move to conversation history.

That keeps the first milestone small, testable, and easy to troubleshoot.
