using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ParkingSystem.Data;
using ParkingSystem.Filters;
using ParkingSystem.Models;
using ParkingSystem.Services;

namespace ParkingSystem.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [AuthorizeRole("Admin")] // Only administrators can access user management
    public class UsersController : ControllerBase
    {
        private readonly ParkingDbContext _context;

        public UsersController(ParkingDbContext context)
        {
            _context = context;
        }

        // GET: api/users
        [HttpGet]
        public async Task<ActionResult<IEnumerable<User>>> GetUsers()
        {
            var users = await _context.Users.ToListAsync();
            // Sanitize password hashes before sending to client
            foreach (var user in users)
            {
                user.PasswordHash = string.Empty;
            }
            return users;
        }

        // GET: api/users/5
        [HttpGet("{id}")]
        public async Task<ActionResult<User>> GetUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "Usuário não encontrado." });
            }
            user.PasswordHash = string.Empty; // Sanitize
            return user;
        }

        // POST: api/users
        [HttpPost]
        public async Task<ActionResult<User>> PostUser([FromBody] CreateUserRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Username) || 
                string.IsNullOrWhiteSpace(request.Password) || string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { message = "Todos os campos são obrigatórios." });
            }

            string usernameClean = request.Username.Trim().ToLower();
            var exists = await _context.Users.AnyAsync(u => u.Username.ToLower() == usernameClean);
            if (exists)
            {
                return BadRequest(new { message = "Este nome de usuário já está em uso." });
            }

            if (request.Role != "Admin" && request.Role != "Cashier")
            {
                return BadRequest(new { message = "Função de usuário inválida. Escolha Admin ou Cashier." });
            }

            var newUser = new User
            {
                Username = request.Username.Trim(),
                PasswordHash = ComputeSha256(request.Password),
                Name = request.Name.Trim(),
                Role = request.Role
            };

            _context.Users.Add(newUser);
            await _context.SaveChangesAsync();

            newUser.PasswordHash = string.Empty; // Sanitize response
            return CreatedAtAction(nameof(GetUser), new { id = newUser.Id }, newUser);
        }

        // PUT: api/users/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutUser(int id, [FromBody] UpdateUserRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { message = "Nome e Usuário são obrigatórios." });
            }

            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "Usuário não encontrado." });
            }

            string usernameClean = request.Username.Trim().ToLower();
            var exists = await _context.Users.AnyAsync(u => u.Username.ToLower() == usernameClean && u.Id != id);
            if (exists)
            {
                return BadRequest(new { message = "Este nome de usuário já está em uso por outro cadastro." });
            }

            if (request.Role != "Admin" && request.Role != "Cashier")
            {
                return BadRequest(new { message = "Função de usuário inválida." });
            }

            // Safety check: Cannot change role of last admin
            if (user.Role == "Admin" && request.Role != "Admin")
            {
                var adminCount = await _context.Users.CountAsync(u => u.Role == "Admin");
                if (adminCount <= 1)
                {
                    return BadRequest(new { message = "Não é permitido alterar o cargo do único administrador do sistema." });
                }
            }

            user.Username = request.Username.Trim();
            user.Name = request.Name.Trim();
            user.Role = request.Role;

            // Update password if a new one is provided
            if (!string.IsNullOrWhiteSpace(request.Password))
            {
                user.PasswordHash = ComputeSha256(request.Password);
            }

            _context.Entry(user).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Usuário atualizado com sucesso." });
        }

        // DELETE: api/users/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "Usuário não encontrado." });
            }

            // Rule 1: Cannot delete self
            var currentUser = HttpContext.Items["User"] as TokenService.TokenPayload;
            if (currentUser != null && currentUser.UserId == id)
            {
                return BadRequest(new { message = "Você não pode excluir o seu próprio usuário enquanto estiver conectado." });
            }

            // Rule 2: Cannot delete last admin
            if (user.Role == "Admin")
            {
                var adminCount = await _context.Users.CountAsync(u => u.Role == "Admin");
                if (adminCount <= 1)
                {
                    return BadRequest(new { message = "Não é possível excluir o último administrador do sistema." });
                }
            }

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Usuário excluído com sucesso." });
        }

        private static string ComputeSha256(string input)
        {
            using (var sha256 = SHA256.Create())
            {
                byte[] bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(input));
                var builder = new StringBuilder();
                foreach (byte b in bytes)
                {
                    builder.Append(b.ToString("x2"));
                }
                return builder.ToString();
            }
        }
    }

    public class CreateUserRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Role { get; set; } = "Cashier";
    }

    public class UpdateUserRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty; // Optional
        public string Name { get; set; } = string.Empty;
        public string Role { get; set; } = "Cashier";
    }
}
