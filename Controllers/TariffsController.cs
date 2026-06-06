using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ParkingSystem.Data;
using ParkingSystem.Filters;
using ParkingSystem.Models;

namespace ParkingSystem.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TariffsController : ControllerBase
    {
        private readonly ParkingDbContext _context;

        public TariffsController(ParkingDbContext context)
        {
            _context = context;
        }

        // GET: api/tariffs
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Tariff>>> GetTariffs()
        {
            return await _context.Tariffs.ToListAsync();
        }

        // GET: api/tariffs/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Tariff>> GetTariff(int id)
        {
            var tariff = await _context.Tariffs.FindAsync(id);

            if (tariff == null)
            {
                return NotFound(new { message = "Tarifa não encontrada." });
            }

            return tariff;
        }

        // PUT: api/tariffs/5
        [AuthorizeRole("Admin")]
        [HttpPut("{id}")]
        public async Task<IActionResult> PutTariff(int id, Tariff tariff)
        {
            if (id != tariff.Id)
            {
                return BadRequest(new { message = "ID incompatível." });
            }

            _context.Entry(tariff).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!TariffExists(id))
                {
                    return NotFound(new { message = "Tarifa não encontrada para atualização." });
                }
                else
                {
                    throw;
                }
            }

            return Ok(tariff);
        }

        private bool TariffExists(int id)
        {
            return _context.Tariffs.Any(e => e.Id == id);
        }
    }
}
