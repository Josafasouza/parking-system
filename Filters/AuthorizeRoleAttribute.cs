using System;
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using ParkingSystem.Services;

namespace ParkingSystem.Filters
{
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class AuthorizeRoleAttribute : Attribute, IAuthorizationFilter
    {
        private readonly string[] _roles;

        public AuthorizeRoleAttribute(params string[] roles)
        {
            _roles = roles;
        }

        public void OnAuthorization(AuthorizationFilterContext context)
        {
            var tokenService = context.HttpContext.RequestServices.GetRequiredService<TokenService>();
            
            // Get authorization header
            string authHeader = context.HttpContext.Request.Headers["Authorization"].ToString();
            
            if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                context.Result = new JsonResult(new { message = "Não autorizado. Token de sessão ausente." }) { StatusCode = 401 };
                return;
            }

            string token = authHeader.Substring("Bearer ".Length).Trim();
            var payload = tokenService.ValidateToken(token);

            if (payload == null)
            {
                context.Result = new JsonResult(new { message = "Não autorizado. Sessão inválida ou expirada." }) { StatusCode = 401 };
                return;
            }

            // Save payload to HTTP Context Items for downstream use if needed
            context.HttpContext.Items["User"] = payload;

            // Check if user has required role
            if (_roles.Length > 0 && !_roles.Contains(payload.Role))
            {
                context.Result = new JsonResult(new { message = "Acesso negado. Você não tem permissão para realizar esta ação." }) { StatusCode = 403 };
                return;
            }
        }
    }
}
