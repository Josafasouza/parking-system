using System.ComponentModel.DataAnnotations;

namespace ParkingSystem.Models
{
    public class Tariff
    {
        public int Id { get; set; }

        [Required]
        public VehicleType VehicleType { get; set; }

        [Required]
        public decimal FirstHourRate { get; set; }

        [Required]
        public decimal AdditionalHourRate { get; set; }

        [Required]
        public int ToleranceMinutes { get; set; } = 15;

        [Required]
        public decimal DailyMaxRate { get; set; } = 100.00m;
    }
}
