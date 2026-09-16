using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using NovarisAI.Core.Interfaces;
using NovarisAI.Web.Models;
using NovarisAI.Services;

namespace NovarisAI.Web.Controllers;

public class HomeController(IOllamaService ollamaService) : Controller
{
    [HttpGet]
    public IActionResult Index()
    {
        return View(new ChatViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Index(ChatViewModel model, CancellationToken cancellationToken)
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

        Response.ContentType = "text/plain; charset=utf-8";
        Response.Headers.CacheControl = "no-cache";

        try
        {
            await foreach (var chunk in ollamaService.AskStreamAsync(model.Prompt, cancellationToken))
            {
                await Response.WriteAsync(chunk, cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
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

    public IActionResult Privacy()
    {
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
