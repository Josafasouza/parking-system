using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ParkingSystem.Data;
using ParkingSystem.Models;
using ParkingSystem.Services;

namespace ParkingSystem.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly ParkingDbContext _context;
        private readonly TokenService _tokenService;

        public AuthController(ParkingDbContext context, TokenService tokenService)
        {
            _context = context;
            _tokenService = tokenService;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest(new { message = "Usuário e senha são obrigatórios." });
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == request.Username.ToLower());
            if (user == null)
            {
                return Unauthorized(new { message = "Usuário ou senha incorretos." });
            }

            string computedHash = ComputeSha256(request.Password);
            if (user.PasswordHash != computedHash)
            {
                return Unauthorized(new { message = "Usuário ou senha incorretos." });
            }

            string token = _tokenService.GenerateToken(user);

            return Ok(new
            {
                token,
                name = user.Name,
                role = user.Role,
                username = user.Username
            });
        }

        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
            {
                return BadRequest(new { message = "Todos os campos são obrigatórios." });
            }

            string authHeader = Request.Headers["Authorization"].ToString();
            if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                return Unauthorized(new { message = "Sessão inválida." });
            }

            string token = authHeader.Substring("Bearer ".Length).Trim();
            var payload = _tokenService.ValidateToken(token);
            if (payload == null)
            {
                return Unauthorized(new { message = "Sessão inválida ou expirada." });
            }

            var user = await _context.Users.FindAsync(payload.UserId);
            if (user == null)
            {
                return NotFound(new { message = "Usuário não encontrado." });
            }

            // Verify current password
            string currentHash = ComputeSha256(request.CurrentPassword);
            if (user.PasswordHash != currentHash)
            {
                return BadRequest(new { message = "A senha atual está incorreta." });
            }

            if (request.NewPassword.Length < 4)
            {
                return BadRequest(new { message = "A nova senha deve ter no mínimo 4 caracteres." });
            }

            // Update password
            user.PasswordHash = ComputeSha256(request.NewPassword);
            _context.Entry(user).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Senha alterada com sucesso." });
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

    public class LoginRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class ChangePasswordRequest
    {
        public string CurrentPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }
}
