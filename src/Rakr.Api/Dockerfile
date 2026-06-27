# Build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy project files and restore
COPY src/Rakr.Domain/Rakr.Domain.csproj Rakr.Domain/
COPY src/Rakr.Application/Rakr.Application.csproj Rakr.Application/
COPY src/Rakr.Infrastructure/Rakr.Infrastructure.csproj Rakr.Infrastructure/
COPY src/Rakr.Api/Rakr.Api.csproj Rakr.Api/
RUN dotnet restore Rakr.Api/Rakr.Api.csproj

# Copy source and build
COPY src/ .
RUN dotnet publish Rakr.Api/Rakr.Api.csproj -c Release -o /app/publish --no-restore

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

# Security: non-root user
RUN adduser --disabled-password --gecos "" appuser
USER appuser

COPY --from=build /app/publish .

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "Rakr.Api.dll"]
