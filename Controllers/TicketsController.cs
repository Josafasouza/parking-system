using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ParkingSystem.Data;
using ParkingSystem.Models;

namespace ParkingSystem.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TicketsController : ControllerBase
    {
        private readonly ParkingDbContext _context;

        public TicketsController(ParkingDbContext context)
        {
            _context = context;
        }

        // GET: api/tickets
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Ticket>>> GetTickets([FromQuery] bool? activeOnly, [FromQuery] string? search)
        {
            IQueryable<Ticket> query = _context.Tickets.Include(t => t.ParkingSpace);

            if (activeOnly.HasValue && activeOnly.Value)
            {
                query = query.Where(t => !t.IsPaid);
            }

            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(t => t.Plate.Contains(search) || t.TicketNumber.Contains(search));
            }

            return await query.OrderByDescending(t => t.EntryTime).ToListAsync();
        }

        // GET: api/tickets/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Ticket>> GetTicket(int id)
        {
            var ticket = await _context.Tickets
                .Include(t => t.ParkingSpace)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (ticket == null)
            {
                return NotFound(new { message = "Ticket não encontrado." });
            }

            return ticket;
        }

        // POST: api/tickets/entry
        [HttpPost("entry")]
        public async Task<IActionResult> RegisterEntry([FromBody] EntryRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Plate))
            {
                return BadRequest(new { message = "A placa do veículo é obrigatória." });
            }

            // Clean plate formatting (uppercase, remove spaces/hyphens if desired, but keep simple)
            var cleanPlate = request.Plate.Trim().ToUpper();

            // Check if vehicle is already parked (active ticket with same plate)
            var alreadyParked = await _context.Tickets
                .AnyAsync(t => !t.IsPaid && t.Plate == cleanPlate);

            if (alreadyParked)
            {
                return BadRequest(new { message = $"O veículo com placa {cleanPlate} já está estacionado." });
            }

            // Check if there is an active Monthly Subscriber
            var monthlySubscriber = await _context.MonthlySubscribers
                .FirstOrDefaultAsync(m => m.Plate == cleanPlate && m.IsActive && m.EndDate >= DateTime.Today);

            bool isMonthly = monthlySubscriber != null;

            // Resolve vehicle details: auto-fill from subscription if monthly and not provided in request
            var vehicleType = isMonthly ? monthlySubscriber!.VehicleType : request.VehicleType;
            var brand = !string.IsNullOrEmpty(request.Brand) ? request.Brand : (isMonthly ? monthlySubscriber!.Brand : null);
            var model = !string.IsNullOrEmpty(request.Model) ? request.Model : (isMonthly ? monthlySubscriber!.Model : null);
            var color = !string.IsNullOrEmpty(request.Color) ? request.Color : (isMonthly ? monthlySubscriber!.Color : null);

            // Find an available parking space of the specified type
            var space = await _context.ParkingSpaces
                .FirstOrDefaultAsync(s => s.AllowedType == vehicleType && !s.IsOccupied);

            if (space == null)
            {
                return BadRequest(new { message = $"Não há vagas disponíveis para o tipo de veículo: {vehicleType}." });
            }

            // Generate unique ticket number
            var timestamp = DateTime.Now.ToString("yyyyMMddHHmmss");
            var randomSuffix = new Random().Next(100, 999);
            var ticketNumber = $"TKT-{timestamp}-{randomSuffix}";

            // Register ticket
            var ticket = new Ticket
            {
                TicketNumber = ticketNumber,
                Plate = cleanPlate,
                VehicleType = vehicleType,
                ParkingSpaceId = space.Id,
                EntryTime = DateTime.Now,
                IsPaid = false,
                AmountPaid = 0.00m,
                IsMonthly = isMonthly,
                Brand = brand,
                Model = model,
                Color = color
            };

            // Update parking space
            space.IsOccupied = true;
            space.OccupiedByPlate = cleanPlate;

            _context.Tickets.Add(ticket);
            await _context.SaveChangesAsync();

            // Return ticket with loaded space information
            ticket.ParkingSpace = space;

            return CreatedAtAction(nameof(GetTicket), new { id = ticket.Id }, ticket);
        }

        // GET: api/tickets/calculate/5
        [HttpGet("calculate/{id}")]
        public async Task<IActionResult> CalculateFee(int id)
        {
            var ticket = await _context.Tickets.FindAsync(id);
            if (ticket == null)
            {
                return NotFound(new { message = "Ticket não encontrado." });
            }

            if (ticket.IsPaid)
            {
                return Ok(new
                {
                    Ticket = ticket,
                    DurationMinutes = (ticket.ExitTime!.Value - ticket.EntryTime).TotalMinutes,
                    Fee = ticket.AmountPaid,
                    IsPaid = true
                });
            }

            var now = DateTime.Now;
            var feeDetails = await ComputeFeeDetails(ticket, now);

            return Ok(new
            {
                Ticket = ticket,
                CurrentTime = now,
                DurationMinutes = feeDetails.DurationMinutes,
                DurationFormatted = feeDetails.FormattedDuration,
                Fee = feeDetails.Fee,
                TariffUsed = feeDetails.TariffUsed,
                IsPaid = false
            });
        }

        // POST: api/tickets/exit/5
        [HttpPost("exit/{id}")]
        public async Task<IActionResult> ProcessExit(int id, [FromBody] ExitRequest request)
        {
            var ticket = await _context.Tickets
                .Include(t => t.ParkingSpace)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (ticket == null)
            {
                return NotFound(new { message = "Ticket não encontrado." });
            }

            if (ticket.IsPaid)
            {
                return BadRequest(new { message = "Este ticket já foi pago e finalizado." });
            }

            var exitTime = DateTime.Now;
            var feeDetails = await ComputeFeeDetails(ticket, exitTime);

            // Update ticket payment details
            ticket.ExitTime = exitTime;
            ticket.IsPaid = true;
            ticket.AmountPaid = feeDetails.Fee;
            ticket.PaymentTime = exitTime;
            ticket.PaymentMethod = string.IsNullOrEmpty(request.PaymentMethod) ? "Dinheiro" : request.PaymentMethod;

            // Free the parking space
            if (ticket.ParkingSpace != null)
            {
                ticket.ParkingSpace.IsOccupied = false;
                ticket.ParkingSpace.OccupiedByPlate = null;
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                Message = "Saída processada com sucesso!",
                Ticket = ticket,
                DurationMinutes = feeDetails.DurationMinutes,
                DurationFormatted = feeDetails.FormattedDuration,
                AmountPaid = ticket.AmountPaid,
                PaymentMethod = ticket.PaymentMethod
            });
        }

        private async Task<FeeCalculationResult> ComputeFeeDetails(Ticket ticket, DateTime exitTime)
        {
            var duration = exitTime - ticket.EntryTime;
            var totalMinutes = duration.TotalMinutes;

            if (totalMinutes < 0) totalMinutes = 0;

            if (ticket.IsMonthly)
            {
                return new FeeCalculationResult
                {
                    DurationMinutes = Math.Round(totalMinutes, 2),
                    FormattedDuration = FormatDuration(duration),
                    Fee = 0.00m,
                    TariffUsed = null
                };
            }

            var tariff = await _context.Tariffs
                .FirstOrDefaultAsync(t => t.VehicleType == ticket.VehicleType);

            if (tariff == null)
            {
                // Fallback basic values if tariff not found
                return new FeeCalculationResult
                {
                    DurationMinutes = totalMinutes,
                    FormattedDuration = FormatDuration(duration),
                    Fee = 0.00m,
                    TariffUsed = null
                };
            }

            // Calculation Logic:
            // 1. If within tolerance: free.
            // 2. First hour: FirstHourRate.
            // 3. Subsequent hours: AdditionalHourRate per hour or fraction of hour.
            // 4. Cap at DailyMaxRate.

            decimal fee = 0.00m;

            if (totalMinutes <= tariff.ToleranceMinutes)
            {
                fee = 0.00m;
            }
            else
            {
                // Charge at least the first hour
                fee += tariff.FirstHourRate;

                if (totalMinutes > 60)
                {
                    var extraMinutes = totalMinutes - 60;
                    // Number of additional hours (ceil to count any fraction as full hour)
                    var extraHours = Math.Ceiling(extraMinutes / 60.0);
                    fee += (decimal)extraHours * tariff.AdditionalHourRate;
                }

                // Daily cap
                if (fee > tariff.DailyMaxRate)
                {
                    fee = tariff.DailyMaxRate;
                }
            }

            return new FeeCalculationResult
            {
                DurationMinutes = Math.Round(totalMinutes, 2),
                FormattedDuration = FormatDuration(duration),
                Fee = Math.Round(fee, 2),
                TariffUsed = tariff
            };
        }

        private string FormatDuration(TimeSpan span)
        {
            int days = span.Days;
            int hours = span.Hours;
            int minutes = span.Minutes;

            var parts = new List<string>();
            if (days > 0) parts.Add($"{days}d");
            if (hours > 0 || days > 0) parts.Add($"{hours}h");
            parts.Add($"{minutes}m");

            return string.Join(" ", parts);
        }

        // Inner classes for API payloads
        public class EntryRequest
        {
            public string Plate { get; set; } = string.Empty;
            public VehicleType VehicleType { get; set; }
            public string? Brand { get; set; }
            public string? Model { get; set; }
            public string? Color { get; set; }
        }

        public class ExitRequest
        {
            public string PaymentMethod { get; set; } = "Dinheiro";
        }

        private class FeeCalculationResult
        {
            public double DurationMinutes { get; set; }
            public string FormattedDuration { get; set; } = string.Empty;
            public decimal Fee { get; set; }
            public Tariff? TariffUsed { get; set; }
        }
    }
}
