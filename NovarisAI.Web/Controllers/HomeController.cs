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