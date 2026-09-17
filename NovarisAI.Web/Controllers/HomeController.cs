using System.Diagnostics;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NovarisAI.Core.Interfaces;
using NovarisAI.Core.Models;
using NovarisAI.Web.Data;
using NovarisAI.Web.Models;
using NovarisAI.Web.Services;

namespace NovarisAI.Web.Controllers;

public class HomeController(
    IOllamaService ollamaService,
    NovarisDbContext database,
    IMarkdownRenderer markdownRenderer) : Controller
{
    [HttpGet]
    public async Task<IActionResult> Index(int? conversationId, CancellationToken cancellationToken)
    {
        return View(await GetViewModelAsync(conversationId, cancellationToken));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Index(ChatViewModel model, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            model.Messages = await GetMessagesAsync(model.ConversationId, cancellationToken);
            return View(model);
        }

        Conversation? conversation = null;

        try
        {
            conversation = await GetOrCreateConversationAsync(model.ConversationId, cancellationToken);
            await AddMessageAsync(conversation, "user", model.Prompt, cancellationToken);

            var response = await ollamaService.AskAsync(
                ToOllamaMessages(conversation),
                cancellationToken);

            await AddMessageAsync(conversation, "assistant", response, cancellationToken);

            return RedirectToAction(nameof(Index), new { conversationId = conversation.Id });
        }
        catch (TaskCanceledException)
        {
            ModelState.AddModelError(string.Empty, "The request was canceled or timed out.");
        }
        catch (HttpRequestException ex)
        {
            ModelState.AddModelError(
                string.Empty,
                $"Unable to communicate with Ollama: {ex.Message}");
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

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task Stream(ChatViewModel model, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            Response.StatusCode = StatusCodes.Status400BadRequest;
            await Response.WriteAsync("Enter a prompt before sending the request.", cancellationToken);
            return;
        }

        try
        {
            var conversation = await GetOrCreateConversationAsync(
                model.ConversationId,
                cancellationToken);

            await AddMessageAsync(conversation, "user", model.Prompt, cancellationToken);

            Response.ContentType = "text/plain; charset=utf-8";
            Response.Headers.CacheControl = "no-cache";
            Response.Headers["X-Conversation-Id"] = conversation.Id.ToString();

            var response = new StringBuilder();

            await foreach (var chunk in ollamaService.AskStreamAsync(
                               ToOllamaMessages(conversation),
                               cancellationToken))
            {
                response.Append(chunk);
                await Response.WriteAsync(chunk, cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }

            if (response.Length > 0)
            {
                await AddMessageAsync(conversation, "assistant", response.ToString(), cancellationToken);
            }
        }
        catch (TaskCanceledException) when (!HttpContext.RequestAborted.IsCancellationRequested)
        {
            if (!Response.HasStarted)
            {
                Response.StatusCode = StatusCodes.Status504GatewayTimeout;
            }

            await Response.WriteAsync("The request was canceled or timed out.", CancellationToken.None);
        }
        catch (HttpRequestException ex)
        {
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

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }

    private async Task<ChatViewModel> GetViewModelAsync(
        int? conversationId,
        CancellationToken cancellationToken)
    {
        if (conversationId is null)
        {
            return new ChatViewModel();
        }

        var conversation = await database.Conversations
            .AsNoTracking()
            .Include(item => item.Messages)
            .SingleOrDefaultAsync(item => item.Id == conversationId, cancellationToken);

        return conversation is null
            ? new ChatViewModel()
            : new ChatViewModel
            {
                ConversationId = conversation.Id,
                Messages = ToViewModels(conversation.Messages)
            };
    }

    private async Task<Conversation> GetOrCreateConversationAsync(
        int? conversationId,
        CancellationToken cancellationToken)
    {
        if (conversationId is not null)
        {
            var existing = await database.Conversations
                .Include(item => item.Messages)
                .SingleOrDefaultAsync(item => item.Id == conversationId, cancellationToken);

            if (existing is not null)
            {
                return existing;
            }
        }

        var now = DateTime.UtcNow;
        var conversation = new Conversation
        {
            CreatedUtc = now,
            UpdatedUtc = now
        };

        database.Conversations.Add(conversation);
        return conversation;
    }

    private async Task AddMessageAsync(
        Conversation conversation,
        string role,
        string content,
        CancellationToken cancellationToken)
    {
        conversation.Messages.Add(new ConversationMessage
        {
            Role = role,
            Content = content,
            CreatedUtc = DateTime.UtcNow
        });
        conversation.UpdatedUtc = DateTime.UtcNow;

        await database.SaveChangesAsync(cancellationToken);
    }

    private async Task<List<ChatMessageViewModel>> GetMessagesAsync(
        int? conversationId,
        CancellationToken cancellationToken)
    {
        if (conversationId is null)
        {
            return [];
        }

        return await database.ConversationMessages
            .AsNoTracking()
            .Where(message => message.ConversationId == conversationId)
            .OrderBy(message => message.Id)
            .Select(message => new ChatMessageViewModel
            {
                Role = message.Role,
                Content = message.Content
            })
            .ToListAsync(cancellationToken);
    }

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
