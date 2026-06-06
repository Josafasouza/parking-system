using System;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ParkingSystem.Models;

namespace ParkingSystem.Services
{
    public class TokenService
    {
        private const string SecretKey = "SuperSecretParkingSystemKeyThatIsVeryLongAndSecure2026!";

        public class TokenPayload
        {
            public int UserId { get; set; }
            public string Username { get; set; } = string.Empty;
            public string Role { get; set; } = string.Empty;
            public DateTime Expiration { get; set; }
        }

        public string GenerateToken(User user)
        {
            var payload = new TokenPayload
            {
                UserId = user.Id,
                Username = user.Username,
                Role = user.Role,
                Expiration = DateTime.UtcNow.AddHours(8) // Token valid for 8 hours
            };

            string payloadJson = JsonSerializer.Serialize(payload);
            string payloadBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(payloadJson))
                .Replace("+", "-")
                .Replace("/", "_")
                .Replace("=", ""); // Base64Url-like format

            string signature = ComputeSignature(payloadBase64);

            return $"{payloadBase64}.{signature}";
        }

        public TokenPayload? ValidateToken(string token)
        {
            if (string.IsNullOrWhiteSpace(token)) return null;

            var parts = token.Split('.');
            if (parts.Length != 2) return null;

            string payloadBase64 = parts[0];
            string signature = parts[1];

            // Verify signature
            string expectedSignature = ComputeSignature(payloadBase64);
            if (!CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(signature), 
                    Encoding.UTF8.GetBytes(expectedSignature)))
            {
                return null;
            }

            try
            {
                // Pad Base64 string if necessary
                string paddedBase64 = payloadBase64.Replace("-", "+").Replace("_", "/");
                switch (paddedBase64.Length % 4)
                {
                    case 2: paddedBase64 += "=="; break;
                    case 3: paddedBase64 += "="; break;
                }

                byte[] payloadBytes = Convert.FromBase64String(paddedBase64);
                string payloadJson = Encoding.UTF8.GetString(payloadBytes);
                var payload = JsonSerializer.Deserialize<TokenPayload>(payloadJson);

                if (payload == null || payload.Expiration < DateTime.UtcNow)
                {
                    return null; // Expired or invalid
                }

                return payload;
            }
            catch
            {
                return null; // Decode/parse error
            }
        }

        private string ComputeSignature(string payload)
        {
            using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(SecretKey)))
            {
                byte[] payloadBytes = Encoding.UTF8.GetBytes(payload);
                byte[] hashBytes = hmac.ComputeHash(payloadBytes);
                return Convert.ToBase64String(hashBytes)
                    .Replace("+", "-")
                    .Replace("/", "_")
                    .Replace("=", ""); // Base64Url-like signature
            }
        }
    }
}
