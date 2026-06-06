using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ParkingSystem.Data;
using ParkingSystem.Filters;
using ParkingSystem.Models;

namespace ParkingSystem.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MonthlySubscribersController : ControllerBase
    {
        private readonly ParkingDbContext _context;

        public MonthlySubscribersController(ParkingDbContext context)
        {
            _context = context;
        }

        // GET: api/monthlysubscribers
        [HttpGet]
        public async Task<ActionResult<IEnumerable<MonthlySubscriber>>> GetSubscribers([FromQuery] string? search)
        {
            IQueryable<MonthlySubscriber> query = _context.MonthlySubscribers;

            if (!string.IsNullOrEmpty(search))
            {
                var searchUpper = search.ToUpper();
                query = query.Where(s => s.Name.Contains(search) || 
                                         s.CPF.Contains(search) || 
                                         s.Plate.Contains(searchUpper));
            }

            return await query.OrderBy(s => s.Name).ToListAsync();
        }

        // GET: api/monthlysubscribers/5
        [HttpGet("{id}")]
        public async Task<ActionResult<MonthlySubscriber>> GetSubscriber(int id)
        {
            var subscriber = await _context.MonthlySubscribers.FindAsync(id);

            if (subscriber == null)
            {
                return NotFound(new { message = "Mensalista não encontrado." });
            }

            return subscriber;
        }

        // POST: api/monthlysubscribers
        [AuthorizeRole("Admin")]
        [HttpPost]
        public async Task<ActionResult<MonthlySubscriber>> PostSubscriber(MonthlySubscriber subscriber)
        {
            if (string.IsNullOrWhiteSpace(subscriber.Plate))
            {
                return BadRequest(new { message = "A placa é obrigatória." });
            }

            subscriber.Plate = subscriber.Plate.Trim().ToUpper();
            
            // Check duplicate plate
            var exists = await _context.MonthlySubscribers.AnyAsync(s => s.Plate == subscriber.Plate);
            if (exists)
            {
                return BadRequest(new { message = $"Já existe um mensalista cadastrado com a placa {subscriber.Plate}." });
            }

            _context.MonthlySubscribers.Add(subscriber);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetSubscriber), new { id = subscriber.Id }, subscriber);
        }

        // PUT: api/monthlysubscribers/5
        [AuthorizeRole("Admin")]
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSubscriber(int id, MonthlySubscriber subscriber)
        {
            if (id != subscriber.Id)
            {
                return BadRequest(new { message = "ID do mensalista incompatível." });
            }

            subscriber.Plate = subscriber.Plate.Trim().ToUpper();

            // Check duplicate plate in other subscribers
            var duplicate = await _context.MonthlySubscribers.AnyAsync(s => s.Plate == subscriber.Plate && s.Id != id);
            if (duplicate)
            {
                return BadRequest(new { message = $"Já existe outro mensalista cadastrado com a placa {subscriber.Plate}." });
            }

            _context.Entry(subscriber).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SubscriberExists(id))
                {
                    return NotFound(new { message = "Mensalista não encontrado." });
                }
                else
                {
                    throw;
                }
            }

            return Ok(subscriber);
        }

        // DELETE: api/monthlysubscribers/5
        [AuthorizeRole("Admin")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSubscriber(int id)
        {
            var subscriber = await _context.MonthlySubscribers.FindAsync(id);
            if (subscriber == null)
            {
                return NotFound(new { message = "Mensalista não encontrado." });
            }

            _context.MonthlySubscribers.Remove(subscriber);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Mensalista removido com sucesso." });
        }

        private bool SubscriberExists(int id)
        {
            return _context.MonthlySubscribers.Any(e => e.Id == id);
        }
    }
}
