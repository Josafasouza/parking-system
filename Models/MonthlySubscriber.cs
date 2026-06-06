using System;
using System.ComponentModel.DataAnnotations;

namespace ParkingSystem.Models
{
    public class MonthlySubscriber
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string CPF { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Plate { get; set; } = string.Empty;

        [Required]
        public VehicleType VehicleType { get; set; }

        [MaxLength(50)]
        public string? Brand { get; set; }

        [MaxLength(50)]
        public string? Model { get; set; }

        [MaxLength(30)]
        public string? Color { get; set; }

        [Required]
        public decimal MonthlyFee { get; set; }

        [Required]
        public DateTime StartDate { get; set; } = DateTime.Today;

        [Required]
        public DateTime EndDate { get; set; } = DateTime.Today.AddMonths(1);

        public bool IsActive { get; set; } = true;
    }
}
