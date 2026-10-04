using Ganss.Xss;
using Markdig;
// Markdig converts Markdown to HTML,
// and Ganss.Xss sanitizes the HTML to prevent XSS attacks.
namespace NovarisAI.Web.Services;

public sealed class MarkdownRenderer : IMarkdownRenderer
{
    private readonly MarkdownPipeline markdownPipeline = new MarkdownPipelineBuilder()
        .UseAdvancedExtensions()
        .DisableHtml()
        .Build();

    private readonly HtmlSanitizer sanitizer = CreateSanitizer();

    /// <summary>
    /// Renders the provided Markdown string to sanitized HTML.
    /// </summary>
    /// <param name="markdown">The Markdown string to render.</param>
    /// <returns>The sanitized HTML string.</returns>
    public string Render(string markdown)
    {
        var html = Markdown.ToHtml(markdown ?? string.Empty, markdownPipeline);
        return sanitizer.Sanitize(html);
    }

    /// <summary>
    /// Creates a new instance of HtmlSanitizer with custom settings.
    /// </summary>
    /// <returns>A configured HtmlSanitizer instance.</returns>
    private static HtmlSanitizer CreateSanitizer()
    {
        var sanitizer = new HtmlSanitizer();
        sanitizer.AllowedAttributes.Add("class");
        return sanitizer;
    }
}
