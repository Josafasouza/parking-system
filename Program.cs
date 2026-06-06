using Microsoft.EntityFrameworkCore;
using ParkingSystem.Data;
using ParkingSystem.Services;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddSingleton<TokenService>();

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Convert Enums to Strings in JSON responses for better API usability
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// Configure CORS for local development
builder.Services.AddCors(options =>
    {
        options.AddDefaultPolicy(policy =>
        {
            policy.AllowAnyOrigin()
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
    });

// Configure SQLite Database Connection
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=parking.db";
builder.Services.AddDbContext<ParkingDbContext>(options =>
    options.UseSqlite(connectionString));

// Add OpenAPI explorer
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

// Automatically create database and run seed data
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ParkingDbContext>();
        context.Database.EnsureCreated();

        // Ensure the Users table exists in the SQLite file
        context.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS ""Users"" (
                ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                ""Username"" TEXT NOT NULL,
                ""PasswordHash"" TEXT NOT NULL,
                ""Name"" TEXT NOT NULL,
                ""Role"" TEXT NOT NULL
            );
        ");

        // Seed default users if they are not already in the table
        context.Database.ExecuteSqlRaw(@"
            INSERT INTO ""Users"" (""Id"", ""Username"", ""PasswordHash"", ""Name"", ""Role"")
            SELECT 1, 'admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'Administrador Geral', 'Admin'
            WHERE NOT EXISTS (SELECT 1 FROM ""Users"" WHERE ""Id"" = 1);

            INSERT INTO ""Users"" (""Id"", ""Username"", ""PasswordHash"", ""Name"", ""Role"")
            SELECT 2, 'caixa', 'e3d7b71d78b2fcdf81575b07832bd28ac63949df11aa6f55dbba726333b77780', 'Operador de Caixa', 'Cashier'
            WHERE NOT EXISTS (SELECT 1 FROM ""Users"" WHERE ""Id"" = 2);
        ");
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Ocorreu um erro ao inicializar o banco de dados SQLite.");
    }
}

// Enable serving index.html and static files from wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseRouting();

app.UseCors();

app.UseAuthorization();

app.MapControllers();

app.Run();
