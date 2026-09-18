using Microsoft.EntityFrameworkCore;
using NovarisAI.Core.Models;

namespace NovarisAI.Web.Data;

public sealed class NovarisDbContext(DbContextOptions<NovarisDbContext> options) : DbContext(options)
{
    public DbSet<Conversation> Conversations => Set<Conversation>();

    public DbSet<ConversationMessage> ConversationMessages => Set<ConversationMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Conversation>(entity =>
        {
            entity.Property(conversation => conversation.CreatedUtc).IsRequired();
            entity.Property(conversation => conversation.UpdatedUtc).IsRequired();

            entity.HasMany(conversation => conversation.Messages)
                .WithOne(message => message.Conversation)
                .HasForeignKey(message => message.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ConversationMessage>(entity =>
        {
            entity.Property(message => message.Role)
                .HasMaxLength(16)
                .IsRequired();

            entity.Property(message => message.Content).IsRequired();
            entity.Property(message => message.CreatedUtc).IsRequired();
            entity.HasIndex(message => new { message.ConversationId, message.Id });
        });
    }
}
