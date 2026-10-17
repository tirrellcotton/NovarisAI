# Your AI Assistant Does Not Have to Leave Your Computer

*How I built a private local coding assistant with ASP.NET Core, Ollama, and Qwen*

There is a default assumption in modern AI: ask a question, send your work to a remote service, and wait for an answer to return from someone else's infrastructure.

That model is convenient. It is also a choice.

For plenty of development work, there is another option: run the model on your own machine, keep the prompt on your own network, and build the application layer with tools you already understand. No API key. No per-token invoice. No dependency on OpenAI, Anthropic, or any other hosted AI provider being available when you need it.

I built a small local coding assistant to explore that option. The stack is deliberately ordinary:

- ASP.NET Core MVC on .NET 10
- C# and Razor views
- Ollama, running locally on Windows
- Qwen2.5-Coder 14B, served by Ollama
- `HttpClientFactory` for the connection between the web application and the local model

The point was not to create a dramatic new AI platform. It was to make a useful, understandable application whose AI requests can remain on the computer where the work is happening.

## Local changes the data boundary

With a hosted AI API, a prompt commonly crosses several boundaries: your machine, the public internet, the provider's service, and whatever storage and processing arrangements support that service. The exact details vary by provider and account configuration, but the essential fact remains: your prompt leaves your environment.

With a local setup, the request path is much smaller:

```text
Browser
  |
  v
ASP.NET Core MVC application
  |
  v
Ollama HTTP API at localhost:11434
  |
  v
Qwen2.5-Coder running on the same machine
```

For the basic version, the prompt goes from the browser to the ASP.NET application and then to an HTTP endpoint on `localhost`. The answer comes back the same way. There is no hosted inference endpoint in that path.

That is meaningful for proprietary source code, internal documentation, client context, and the ordinary half-formed questions developers ask while working. Local inference does not remove every security responsibility, but it gives you direct control over a very important boundary.

## Independence is practical, not ideological

This is not an argument that hosted models are never useful. They can be excellent tools. But a development workflow should not become unusable because an external API is unavailable, an account changes, a pricing model shifts, or a network connection is unreliable.

A local model gives you a second path. You can run it on a laptop, a workstation, or an internal machine. You can choose the model that fits your hardware and task. You can configure the behavior of your own application. And you can keep using it when an internet connection is not part of the picture.

There is an important distinction here: using a locally run model does not mean pretending the model had no origin or license. Review the model's license, terms, intended use, and hardware requirements before adopting it. The operational advantage is that once the model is downloaded and served locally, your day-to-day prompts do not have to depend on a remote inference provider.

## Start by proving the local model works

Before writing application code, I installed Ollama and pulled a coding-focused model:

```powershell
ollama pull qwen2.5-coder:14b
```

Then I tested it directly:

```powershell
ollama run qwen2.5-coder:14b
```

That simple test matters. It separates two problems that are easy to confuse: whether the model stack works on the machine, and whether the web application integrates with it correctly.

If the model can answer a basic prompt in the terminal, the local AI runtime is ready. The web application is then just a client of a service you control.

## Keep the application architecture boring

The ASP.NET application follows a familiar MVC shape. The browser posts a prompt to a controller. The controller calls an interface. The interface is implemented by a service that speaks to Ollama.

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
Ollama /api/chat
```

This is intentionally unremarkable architecture, and that is one of its strengths. The controller does not need to know how Ollama formats JSON. The Razor view does not need to know the model name. The service handles the transport work: it constructs the request, posts it to `/api/chat`, reads the JSON response, and returns the generated text.

The request includes a system message that establishes the assistant's role and coding preferences, followed by the user's prompt. For example, I can ask it to prefer C#, ASP.NET Core MVC, Bootstrap, xUnit, and maintainable code without stuffing those directions into every question.

That system prompt is not magic. It is simply a transparent, editable part of the application. I prefer that over burying important behavior in an opaque hosted configuration.

## Use the platform features you already trust

The integration uses a typed `HttpClient` registered through `IHttpClientFactory`. The client points to:

```text
http://localhost:11434
```

Using `IHttpClientFactory` keeps the HTTP configuration in one well-known place and avoids manually creating clients across the application. The controller uses normal model validation, anti-forgery validation, asynchronous actions, and a cancellation token. None of these are exotic AI patterns. They are standard web application practices applied to a local model endpoint.

That is worth emphasizing because AI projects often acquire complexity before they acquire usefulness. A plain MVC form, a prompt textbox, and an answer area are enough to prove the interaction and learn from it.

## Put model configuration outside the code

The first version can hard-code a model name, but it should not stay that way. I moved the endpoint and model into `appsettings.json`:

```json
"Ollama": {
  "BaseUrl": "http://localhost:11434",
  "Model": "qwen2.5-coder:14b"
}
```

Then the application reads those values through a strongly typed options class.

This small decision keeps the model choice separate from the implementation. Changing a model should be a configuration change, not a scavenger hunt through controllers and services. It also makes the local assistant easier to operate across different machines, where available memory and preferred models may differ.

## Local still needs failure handling

Running AI locally does not mean it will never fail. Ollama might not be running. A model might not be downloaded. Initial model loading can take time. A machine can be under memory pressure. A user can cancel a request.

The application should acknowledge those realities instead of turning them into vague errors. In the controller, I handle cancellation, HTTP communication failures, and unexpected exceptions separately. The user gets a useful message, while a production application should log the underlying exception for diagnosis.

This is another reason I like the local approach: the operational behavior is visible. When something fails, there is a short, inspectable chain from the browser to the controller, from the controller to the local service, and from the service to the model runtime.

## What this approach gives you

At this stage, the assistant is intentionally modest. It accepts a prompt and returns an answer. But it already has several properties that are difficult to retrofit later:

- Prompts can remain on the local machine.
- The core workflow works without a hosted AI API account.
- The model runtime is directly inspectable and replaceable.
- The web application uses conventional, maintainable ASP.NET patterns.
- Configuration, error behavior, and prompting are all under the application's control.

There are tradeoffs. A 14B coding model requires capable hardware and may respond more slowly than a large hosted model. Local setup takes effort. Model quality varies by task. And keeping everything local shifts more responsibility to you for updates, access control, logging, and backups.

Those are real costs. They are also explicit costs, which makes them easier to evaluate honestly.

## A useful definition of private AI

Private AI is not a slogan and it is not a guarantee that software is automatically secure. It is a design decision about where inference runs, where prompts travel, and who operates the critical pieces.

For me, a local coding assistant is a practical starting point. It keeps the model close to the code, uses an architecture I can inspect, and avoids making a third-party AI platform a mandatory dependency for everyday work.

You do not need to reject cloud AI to value that. You only need to decide that some work deserves an option that is yours.

---

### Editor's notes before publishing

- Add a short first-person example of the type of code or documentation you would not want to submit to a hosted service.
- Confirm the current Qwen model license and Ollama installation guidance before publishing.
- Consider adding screenshots of the chat page, Ollama terminal test, and the local request flow.
- Add your preferred disclosure about AI assistance, if applicable.