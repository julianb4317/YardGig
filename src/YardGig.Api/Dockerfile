# Build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy project files and restore
COPY src/YardGig.Domain/YardGig.Domain.csproj YardGig.Domain/
COPY src/YardGig.Application/YardGig.Application.csproj YardGig.Application/
COPY src/YardGig.Infrastructure/YardGig.Infrastructure.csproj YardGig.Infrastructure/
COPY src/YardGig.Api/YardGig.Api.csproj YardGig.Api/
RUN dotnet restore YardGig.Api/YardGig.Api.csproj

# Copy source and build
COPY src/ .
RUN dotnet publish YardGig.Api/YardGig.Api.csproj -c Release -o /app/publish --no-restore

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

ENTRYPOINT ["dotnet", "YardGig.Api.dll"]
