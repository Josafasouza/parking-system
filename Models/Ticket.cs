using System.ComponentModel.DataAnnotations;

namespace ParkingSystem.Models
{
    public class Ticket
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string TicketNumber { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Plate { get; set; } = string.Empty;

        [Required]
        public VehicleType VehicleType { get; set; }

        [Required]
        public int ParkingSpaceId { get; set; }
        public ParkingSpace? ParkingSpace { get; set; }

        [Required]
        public DateTime EntryTime { get; set; } = DateTime.Now;

        public DateTime? ExitTime { get; set; }

        public bool IsPaid { get; set; } = false;

        public decimal AmountPaid { get; set; } = 0.00m;

        public DateTime? PaymentTime { get; set; }

        [MaxLength(30)]
        public string? PaymentMethod { get; set; }

        public bool IsMonthly { get; set; } = false;

        [MaxLength(50)]
        public string? Brand { get; set; }

        [MaxLength(50)]
        public string? Model { get; set; }

        [MaxLength(30)]
        public string? Color { get; set; }
    }
}
