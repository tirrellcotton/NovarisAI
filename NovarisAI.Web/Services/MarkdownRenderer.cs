using Ganss.Xss;
using Markdig;

namespace NovarisAI.Web.Services;

public sealed class MarkdownRenderer : IMarkdownRenderer
{
    private readonly MarkdownPipeline markdownPipeline = new MarkdownPipelineBuilder()
        .UseAdvancedExtensions()
        .DisableHtml()
        .Build();

    private readonly HtmlSanitizer sanitizer = CreateSanitizer();

    public string Render(string markdown)
    {
        var html = Markdown.ToHtml(markdown ?? string.Empty, markdownPipeline);
        return sanitizer.Sanitize(html);
    }

    private static HtmlSanitizer CreateSanitizer()
    {
        var sanitizer = new HtmlSanitizer();
        sanitizer.AllowedAttributes.Add("class");
        return sanitizer;
    }
}
