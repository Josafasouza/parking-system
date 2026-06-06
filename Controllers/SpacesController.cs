using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ParkingSystem.Data;
using ParkingSystem.Models;
using ParkingSystem.Filters;

namespace ParkingSystem.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SpacesController : ControllerBase
    {
        private readonly ParkingDbContext _context;

        public SpacesController(ParkingDbContext context)
        {
            _context = context;
        }

        // GET: api/spaces
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ParkingSpace>>> GetSpaces()
        {
            return await _context.ParkingSpaces.ToListAsync();
        }

        // GET: api/spaces/stats
        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            var total = await _context.ParkingSpaces.CountAsync();
            var occupied = await _context.ParkingSpaces.CountAsync(s => s.IsOccupied);
            var free = total - occupied;

            var carTotal = await _context.ParkingSpaces.CountAsync(s => s.AllowedType == VehicleType.Car);
            var carOccupied = await _context.ParkingSpaces.CountAsync(s => s.AllowedType == VehicleType.Car && s.IsOccupied);

            var motoTotal = await _context.ParkingSpaces.CountAsync(s => s.AllowedType == VehicleType.Motorcycle);
            var motoOccupied = await _context.ParkingSpaces.CountAsync(s => s.AllowedType == VehicleType.Motorcycle && s.IsOccupied);

            var truckTotal = await _context.ParkingSpaces.CountAsync(s => s.AllowedType == VehicleType.Truck);
            var truckOccupied = await _context.ParkingSpaces.CountAsync(s => s.AllowedType == VehicleType.Truck && s.IsOccupied);

            // Today's total revenue
            var today = DateTime.Today;
            var todayRevenue = await _context.Tickets
                .Where(t => t.IsPaid && t.PaymentTime >= today)
                .SumAsync(t => t.AmountPaid);

            // Average stay duration in minutes (completed tickets)
            var completedTickets = await _context.Tickets
                .Where(t => t.ExitTime != null)
                .ToListAsync();

            double avgDuration = 0;
            if (completedTickets.Count > 0)
            {
                avgDuration = completedTickets.Average(t => (t.ExitTime!.Value - t.EntryTime).TotalMinutes);
            }

            return Ok(new
            {
                TotalSpaces = total,
                OccupiedSpaces = occupied,
                FreeSpaces = free,
                Car = new { Total = carTotal, Occupied = carOccupied, Free = carTotal - carOccupied },
                Motorcycle = new { Total = motoTotal, Occupied = motoOccupied, Free = motoTotal - motoOccupied },
                Truck = new { Total = truckTotal, Occupied = truckOccupied, Free = truckTotal - truckOccupied },
                TodayRevenue = todayRevenue,
                AvgDurationMinutes = Math.Round(avgDuration, 1)
            });
        }

        // POST: api/spaces/capacity
        [HttpPost("capacity")]
        [AuthorizeRole("Admin")] // Only administrators can change capacity
        public async Task<IActionResult> UpdateCapacity([FromBody] UpdateCapacityRequest request)
        {
            if (request == null || request.CarCapacity < 0 || request.MotorcycleCapacity < 0 || request.TruckCapacity < 0)
            {
                return BadRequest(new { message = "As capacidades devem ser números inteiros maiores ou iguais a zero." });
            }

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    await AdjustCapacityForType(VehicleType.Car, request.CarCapacity, "A");
                    await AdjustCapacityForType(VehicleType.Motorcycle, request.MotorcycleCapacity, "B");
                    await AdjustCapacityForType(VehicleType.Truck, request.TruckCapacity, "C");

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();
                    
                    return Ok(new { message = "Capacidade de vagas atualizada com sucesso!" });
                }
                catch (InvalidOperationException ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new { message = ex.Message });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return StatusCode(500, new { message = "Ocorreu um erro interno ao atualizar a capacidade.", detail = ex.Message });
                }
            }
        }

        private async Task AdjustCapacityForType(VehicleType type, int targetCapacity, string prefix)
        {
            var existingSpaces = await _context.ParkingSpaces
                .Where(s => s.AllowedType == type)
                .OrderBy(s => s.Code)
                .ToListAsync();

            int currentCount = existingSpaces.Count;

            if (targetCapacity > currentCount)
            {
                // Add new spaces
                int startNum = 1;
                if (existingSpaces.Any())
                {
                    var lastSpace = existingSpaces.Last();
                    var parts = lastSpace.Code.Split('-');
                    if (parts.Length == 2 && int.TryParse(parts[1], out int lastNum))
                    {
                        startNum = lastNum + 1;
                    }
                }

                for (int i = 0; i < (targetCapacity - currentCount); i++)
                {
                    int nextNum = startNum + i;
                    var newSpace = new ParkingSpace
                    {
                        Code = $"{prefix}-{nextNum:D2}",
                        AllowedType = type,
                        IsOccupied = false
                    };
                    _context.ParkingSpaces.Add(newSpace);
                }
            }
            else if (targetCapacity < currentCount)
            {
                // Remove excess spaces from the end
                var spacesToRemove = existingSpaces.Skip(targetCapacity).ToList();

                // Safety check: None of the spaces to remove should be occupied
                if (spacesToRemove.Any(s => s.IsOccupied))
                {
                    string categoryName = type == VehicleType.Car ? "Carros" : (type == VehicleType.Motorcycle ? "Motos" : "Utilitários");
                    throw new InvalidOperationException($"Não é possível reduzir a capacidade de {categoryName} para {targetCapacity} porque uma ou mais vagas a serem removidas estão ocupadas.");
                }

                _context.ParkingSpaces.RemoveRange(spacesToRemove);
            }
        }
    }

    public class UpdateCapacityRequest
    {
        public int CarCapacity { get; set; }
        public int MotorcycleCapacity { get; set; }
        public int TruckCapacity { get; set; }
    }
}
