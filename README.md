# Novaris AI

Novaris AI is a local-first AI workspace built with ASP.NET Core MVC and [Ollama](https://ollama.com/). It provides a polished chat interface for coding, technical reasoning, analysis, documentation, and general-purpose assistance without sending prompts to a hosted AI provider.

The app includes a navy, cyan, and gold Novaris interface with light and dark themes, a compass-inspired favicon, streaming responses, Markdown rendering, and persisted conversation history.

## Features

- Runs against local Ollama models.
- Streams responses into the chat interface.
- Persists conversations and messages in a local SQLite database.
- Renders model responses as sanitized Markdown with syntax highlighting.
- Offers selectable models and purpose-specific assistant modes.
- Provides light and dark themes; the selected theme is remembered in browser storage.
- Uses a responsive ASP.NET Core MVC interface.

## Supported models

The model selector currently supports these Ollama model tags. Install the models you plan to use before starting a conversation.

| Model | Ollama tag | Best for |
| --- | --- | --- |
| Qwen Coder 7B | `qwen2.5-coder:7b` | Fast, lightweight coding questions and snippets. |
| Qwen Coder 14B | `qwen2.5-coder:14b` | More involved implementation, debugging, and code reasoning. |
| Gemma 3 12B | `gemma3:12b` | General assistance, explanations, drafts, and summaries. |
| Phi-4 | `phi4` | Math, analysis, logic, and technical problem solving. |

## Assistant modes

Assistant modes add a focused system prompt to the selected model. The available modes are:

- General
- C# Developer
- Python Developer
- Code Review
- Unit Tests
- Software Architecture
- SQL
- Front End Developer
- Documentation
- Math (Phi-4)
- Analytical Reasoning (Phi-4)
- Technical Problem Solving (Phi-4)

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Ollama](https://ollama.com/) running locally

## Getting started

1. Clone the repository and enter the project folder.

   ```bash
   git clone <your-repository-url>
   cd NovarisAI
   ```

2. Start Ollama. The desktop app normally starts its local server automatically. To confirm that it is available, run:

   ```bash
   ollama list
   ```

3. Download one or more supported models. For example:

   ```bash
   ollama pull qwen2.5-coder:7b
   ollama pull qwen2.5-coder:14b
   ollama pull gemma3:12b
   ollama pull phi4
   ```

4. Restore and run the web application:

   ```bash
   dotnet restore
   dotnet run --project NovarisAI.Web
   ```

5. Open the HTTPS URL shown in the console, then select an installed model and an assistant mode.

## Configuration

Ollama connection settings live in [`NovarisAI.Web/appsettings.json`](NovarisAI.Web/appsettings.json):

```json
"Ollama": {
  "BaseUrl": "http://localhost:11434",
  "Model": "qwen2.5-coder:7b"
}
```

`BaseUrl` is used to reach the local Ollama server. The app validates selections against its supported model list, so the selected model must also be installed in Ollama.

## Project structure

```text
NovarisAI.Core/       Shared models, configuration, and interfaces
NovarisAI.Services/   Ollama client and assistant-mode prompts
NovarisAI.Web/        ASP.NET Core MVC application, UI, SQLite data access
Documentation/        Project notes and setup guide
```

At startup, the web app creates its SQLite database automatically at `NovarisAI.Web/Data/novaris.db`. This data stays on the local machine and is excluded from source control.

## Development

Build the full solution:

```bash
dotnet build NovarisAI.sln
```

Run the application with hot reload:

```bash
dotnet watch --project NovarisAI.Web
```

## Notes

- Novaris AI sends prompts and conversation context to the configured Ollama endpoint. With the default configuration, this is `localhost`.
- Model availability, response quality, and speed depend on the models installed locally and the machine's available CPU, memory, and GPU resources.
- The application sanitizes rendered Markdown, but model output should still be reviewed before use in production code or operational decisions.

## License

No license has been specified for this repository. Add a license file before distributing or reusing the project outside your organization.
