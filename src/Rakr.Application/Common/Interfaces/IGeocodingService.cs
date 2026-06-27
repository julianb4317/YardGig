using NetTopologySuite.Geometries;

namespace Rakr.Application.Common.Interfaces;

public interface IGeocodingService
{
    Task<Point?> GeocodeAddressAsync(string address, CancellationToken cancellationToken = default);
}
