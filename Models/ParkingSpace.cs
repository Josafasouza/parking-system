using System.ComponentModel.DataAnnotations;

namespace ParkingSystem.Models
{
    public class ParkingSpace
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(20)]
        public string Code { get; set; } = string.Empty;

        [Required]
        public VehicleType AllowedType { get; set; }

        public bool IsOccupied { get; set; } = false;

        [MaxLength(20)]
        public string? OccupiedByPlate { get; set; }
    }
}
