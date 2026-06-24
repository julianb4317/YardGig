using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using YardGig.Application.Auth.Interfaces;
using YardGig.Application.Common.Interfaces;
using YardGig.Application.Notifications.Interfaces;
using YardGig.Infrastructure.Identity;
using YardGig.Infrastructure.Notifications;
using YardGig.Infrastructure.Persistence;
using YardGig.Infrastructure.Services;

namespace YardGig.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // PostgreSQL + PostGIS (domain data)
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString("DefaultConnection"),
                npgsql =>
                {
                    npgsql.UseNetTopologySuite();
                    npgsql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
                }));

        services.AddScoped<IAppDbContext>(provider => provider.GetRequiredService<AppDbContext>());

        // Identity DbContext (separate schema)
        services.AddDbContext<AppIdentityDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString("DefaultConnection"),
                npgsql => npgsql.MigrationsAssembly(typeof(AppIdentityDbContext).Assembly.FullName)));

        // ASP.NET Core Identity
        services.AddIdentity<AppIdentityUser, AppIdentityRole>(options =>
            {
                // Password policy
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = true;
                options.Password.RequiredLength = 12;
                options.Password.RequiredUniqueChars = 4;

                // Lockout policy
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.AllowedForNewUsers = true;

                // User settings
                options.User.RequireUniqueEmail = true;
                options.User.AllowedUserNameCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._@+";

                // Sign-in settings
                options.SignIn.RequireConfirmedEmail = true;
                options.SignIn.RequireConfirmedAccount = true;

                // Token lifespan
                options.Tokens.EmailConfirmationTokenProvider = TokenOptions.DefaultEmailProvider;
            })
            .AddEntityFrameworkStores<AppIdentityDbContext>()
            .AddDefaultTokenProviders()
            .AddTokenProvider<AuthenticatorTokenProvider<AppIdentityUser>>(
                TokenOptions.DefaultAuthenticatorProvider);

        // Configure token lifespan
        services.Configure<DataProtectionTokenProviderOptions>(options =>
        {
            options.TokenLifespan = TimeSpan.FromHours(2); // Email confirmation / password reset tokens
        });

        // Authorization policies
        services.AddAppAuthorization();

        // Auth service
        services.AddScoped<IAuthService, AuthService>();

        // HTTP clients
        services.AddHttpClient("GoogleGeocoding");

        // Services
        services.AddScoped<IGeocodingService, GeocodingService>();
        services.AddScoped<IPaymentService, StripePaymentService>();
        services.AddScoped<ICommissionService, CommissionService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<IJobMapNotifier, SignalRJobMapNotifier>();

        // Notification system
        services.AddScoped<INotificationDispatcher, NotificationDispatcher>();
        services.AddScoped<IPreferenceService, PreferenceService>();
        services.AddScoped<ITemplateRenderer, SimpleTemplateRenderer>();
        services.AddScoped<IEmailProvider, LogEmailProvider>();
        services.AddScoped<IPushProvider, LogPushProvider>();
        services.AddHostedService<OutboxProcessor>();

        return services;
    }
}
