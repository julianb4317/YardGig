using NetTopologySuite.Geometries;

namespace YardGig.Application.Common.Interfaces;

public interface IGeocodingService
{
    Task<Point?> GeocodeAddressAsync(string address, CancellationToken cancellationToken = default);
}
