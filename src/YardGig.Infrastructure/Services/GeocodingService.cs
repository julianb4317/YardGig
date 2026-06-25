using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;
using YardGig.Application.Common.Interfaces;

namespace YardGig.Infrastructure.Services;

public class GeocodingService(
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<GeocodingService> logger
) : IGeocodingService
{
    public async Task<Point?> GeocodeAddressAsync(string address, CancellationToken cancellationToken = default)
    {
        var apiKey = configuration["GoogleMaps:ApiKey"];
        if (string.IsNullOrEmpty(apiKey))
        {
            // Development fallback: generate a deterministic point from the address hash
            // so jobs can be created without a Google Maps API key
            logger.LogWarning("Google Maps API key not configured. Using fallback coordinates for: {Address}", address);
            var hash = Math.Abs(address.GetHashCode());
            var lat = 39.7 + (hash % 1000) / 10000.0;  // Denver area ~39.7
            var lng = -104.9 - (hash % 1000) / 10000.0; // Denver area ~-104.9
            return new Point(lng, lat) { SRID = 4326 };
        }

        try
        {
            var client = httpClientFactory.CreateClient("GoogleGeocoding");
            var encodedAddress = Uri.EscapeDataString(address);
            var response = await client.GetFromJsonAsync<GeocodeResponse>(
                $"https://maps.googleapis.com/maps/api/geocode/json?address={encodedAddress}&key={apiKey}",
                cancellationToken);

            if (response?.Results is { Count: > 0 })
            {
                var location = response.Results[0].Geometry.Location;
                return new Point(location.Lng, location.Lat) { SRID = 4326 };
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Geocoding failed for address: {Address}", address);
        }

        return null;
    }

    private class GeocodeResponse
    {
        [JsonPropertyName("results")]
        public List<GeocodeResult> Results { get; set; } = [];
    }

    private class GeocodeResult
    {
        [JsonPropertyName("geometry")]
        public GeocodeGeometry Geometry { get; set; } = null!;
    }

    private class GeocodeGeometry
    {
        [JsonPropertyName("location")]
        public GeocodeLocation Location { get; set; } = null!;
    }

    private class GeocodeLocation
    {
        [JsonPropertyName("lat")]
        public double Lat { get; set; }

        [JsonPropertyName("lng")]
        public double Lng { get; set; }
    }
}
