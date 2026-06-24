namespace YardGig.Domain.Entities;

public class Role
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty; // Customer, Vendor, Admin

    public ICollection<UserRole> UserRoles { get; set; } = [];
}
