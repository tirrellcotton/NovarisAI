using System.Diagnostics;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using NovarisAI.Core.Interfaces;
using NovarisAI.Core.Models;
using NovarisAI.Web.Models;
using NovarisAI.Web.Services;

namespace NovarisAI.Web.Controllers;

public class HomeController(
    IOllamaService ollamaService,
    IConversationManager conversationManager,
    IMarkdownRenderer markdownRenderer) : Controller
{
    /// <summary>
    /// Displays the chat interface, optionally loading an existing conversation if a conversation ID is provided.
    /// </summary>
    /// <param name="conversationId">The ID of the conversation to load, if any.</param>
    /// <param name="cancellationToken">A token to monitor for cancellation requests.</param>
    /// <returns>The view model for the chat interface.</returns>
    [HttpGet]
    public async Task<IActionResult> Index(int? conversationId, CancellationToken cancellationToken)
    {
        return View(await GetViewModelAsync(conversationId, cancellationToken));
    }

    /// <summary>
    /// Handles the submission of a chat prompt, sending it to the Ollama service and updating the conversation with the
    /// user's message and the assistant's response.
    /// </summary>
    /// <param name="model">The view model containing the chat prompt and conversation information.</param>
    /// <param name="cancellationToken">A token to monitor for cancellation requests.</param>
    /// <returns>An IActionResult representing the result of the action.</returns>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Index(ChatViewModel model, CancellationToken cancellationToken)
    {
        ValidateChatOptions(model);

        if (!ModelState.IsValid)
        {
            model.Messages = await GetMessagesAsync(model.ConversationId, cancellationToken);
            return View(model);
        }
        
        Conversation? conversation = null;

        try
        {
            if (model.ConversationId.HasValue)
            {
                // If a conversation ID is provided, attempt to retrieve the existing conversation from the database.
                conversation = await conversationManager.GetConversationAsync(model.ConversationId.Value, cancellationToken);
            }

            // If no existing conversation is found, create a new conversation.
            conversation ??= conversationManager.CreateConversation();
            
            await conversationManager.AddMessageAsync(conversation, "user", model.Prompt, cancellationToken);

            var response = await ollamaService.AskAsync(
                ToOllamaMessages(conversation),
                model.SelectedModel,
                model.PromptPreset,
                cancellationToken);

            await conversationManager.AddMessageAsync(conversation, "assistant", response, cancellationToken);
            return RedirectToAction(nameof(Index), new { conversationId = conversation.Id });
        }
        catch (TaskCanceledException)
        {
            ModelState.AddModelError(string.Empty, "The request was canceled or timed out.");
        }
        catch (HttpRequestException ex)
        {
            ModelState.AddModelError(string.Empty, $"Unable to communicate with Ollama: {ex.Message}");
        }
        catch (Exception)
        {
            ModelState.AddModelError(string.Empty, "An unexpected error occurred.");
        }

        model.ConversationId = conversation?.Id ?? model.ConversationId;
        model.Messages = conversation is null
            ? await GetMessagesAsync(model.ConversationId, cancellationToken)
            : ToViewModels(conversation.Messages);

        return View(model);
    }

    /// <summary>
    ///  Streams the response from the Ollama service in real-time, sending chunks of data to the client as
    ///  they are received.
    /// </summary>
    /// <param name="model"></param>
    /// <param name="cancellationToken"></param>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task Stream(ChatViewModel model, CancellationToken cancellationToken)
    {
        ValidateChatOptions(model);

        // If the model state is invalid, return a 400 Bad Request response with an error message.
        if (!ModelState.IsValid)
        {
            Response.StatusCode = StatusCodes.Status400BadRequest;
            await Response.WriteAsync("Enter a prompt before sending the request.", cancellationToken);
            return;
        }

        try
        {
            Conversation? conversation = null;
            
            if (model.ConversationId.HasValue)
            {
                conversation = await conversationManager.GetConversationAsync(model.ConversationId.Value, cancellationToken);
            }

            if (conversation is null)
            {
                conversation = conversationManager.CreateConversation();
            }

            await conversationManager.AddMessageAsync(conversation, "user", model.Prompt, cancellationToken);

            Response.ContentType = "text/plain; charset=utf-8";
            Response.Headers.CacheControl = "no-cache";
            Response.Headers["X-Conversation-Id"] = conversation.Id.ToString();

            var response = new StringBuilder();

            // Stream the response from the Ollama service in real-time, sending chunks of data to the client as
            // they are received.
            await foreach (var chunk in ollamaService.AskStreamAsync(
                               ToOllamaMessages(conversation),
                               model.SelectedModel,
                               model.PromptPreset,
                               cancellationToken))
            {
                response.Append(chunk);
                await Response.WriteAsync(chunk, cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }

            if (response.Length > 0)
            {
                await conversationManager.AddMessageAsync(conversation, "assistant", response.ToString(), 
                    cancellationToken);
            }
        }
        catch (TaskCanceledException) when (!HttpContext.RequestAborted.IsCancellationRequested)
        {
            // If the request was canceled due to a timeout, set the response status code to 504 Gateway Timeout.
            if (!Response.HasStarted)
            {
                Response.StatusCode = StatusCodes.Status504GatewayTimeout;
            }

            await Response.WriteAsync("The request was canceled or timed out.", CancellationToken.None);
        }
        catch (HttpRequestException ex)
        {
            // If there was an error communicating with the Ollama service, set the response status code
            // to 502 Bad Gateway.
            if (!Response.HasStarted)
            {
                Response.StatusCode = StatusCodes.Status502BadGateway;
            }

            await Response.WriteAsync(
                $"Unable to communicate with Ollama: {ex.Message}",
                CancellationToken.None);
        }
        catch (Exception)
        {
            if (!Response.HasStarted)
            {
                Response.StatusCode = StatusCodes.Status500InternalServerError;
            }

            await Response.WriteAsync("An unexpected error occurred.", CancellationToken.None);
        }
    }

    /// <summary>
    /// Renders the provided Markdown string to sanitized HTML using the MarkdownRenderer service.
    /// </summary>
    /// <param name="markdown">The Markdown string to render.</param>
    /// <returns>A ContentResult containing the rendered HTML.</returns>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public ContentResult RenderMarkdown([FromForm] string markdown)
    {
        return Content(markdownRenderer.Render(markdown), "text/html");
    }

    public IActionResult Privacy()
    {
        return View();
    }

    /// <summary>
    /// Validates the selected model and prompt preset in the provided ChatViewModel. If either is invalid,
    /// adds a model error to the ModelState.
    /// </summary>
    /// <param name="model">The ChatViewModel to validate.</param>
    private void ValidateChatOptions(ChatViewModel model)
    {
        if (!ChatModelOptions.IsSupported(model.SelectedModel))
        {
            ModelState.AddModelError(
                nameof(model.SelectedModel),
                "Select a supported model.");
        }

        if (!Enum.IsDefined(model.PromptPreset))
        {
            ModelState.AddModelError(nameof(model.PromptPreset), "Select a supported assistant mode.");
        }
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }

    /// <summary>
    /// Retrieves the chat view model for the specified conversation ID. If the conversation ID is null
    /// or the conversation does not exist, returns a new ChatViewModel.
    /// </summary>
    /// <param name="conversationId">The ID of the conversation.</param>
    /// <param name="cancellationToken">A cancellation token.</param>
    /// <returns>A ChatViewModel representing the conversation.</returns>
    private async Task<ChatViewModel> GetViewModelAsync(int? conversationId, CancellationToken cancellationToken)
    {
        if (conversationId is null)
        {
            return new ChatViewModel();
        }

        var conversation = await conversationManager.GetConversationAsync(conversationId.Value, cancellationToken);

        return conversation is null
            ? new ChatViewModel()
            : new ChatViewModel
            {
                ConversationId = conversation.Id,
                Messages = ToViewModels(conversation.Messages)
            };
    }

    /// <summary>
    /// Retrieves the messages for the specified conversation ID. If the conversation ID is null,
    /// returns an empty list.
    /// </summary>
    /// <param name="conversationId"></param>
    /// <param name="cancellationToken"></param>
    /// <returns></returns>
    private async Task<List<ChatMessageViewModel>> GetMessagesAsync(
        int? conversationId,
        CancellationToken cancellationToken)
    {
        var messages = await conversationManager.GetMessagesAsync(conversationId, cancellationToken);
        return ToViewModels(messages);
    }

    /// <summary>
    /// Converts a Conversation object to a list of OllamaMessage objects, ordered by message ID.
    /// </summary>
    /// <param name="conversation">The Conversation object to convert.</param>
    /// <returns>A list of OllamaMessage objects.</returns>
    private static List<OllamaMessage> ToOllamaMessages(Conversation conversation)
    {
        return conversation.Messages
            .OrderBy(message => message.Id)
            .Select(message => new OllamaMessage
            {
                Role = message.Role,
                Content = message.Content
            })
            .ToList();
    }

    /// <summary>
    /// Converts a collection of ConversationMessage objects to a list of ChatMessageViewModel objects,
    /// ordered by message ID.
    /// </summary>
    /// <param name="messages"></param>
    /// <returns></returns>
    private static List<ChatMessageViewModel> ToViewModels(
        IEnumerable<ConversationMessage> messages)
    {
        return messages
            .OrderBy(message => message.Id)
            .Select(message => new ChatMessageViewModel
            {
                Role = message.Role,
                Content = message.Content
            })
            .ToList();
    }
}
