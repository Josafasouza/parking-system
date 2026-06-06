using System;
using Microsoft.EntityFrameworkCore;
using ParkingSystem.Models;

namespace ParkingSystem.Data
{
    public class ParkingDbContext : DbContext
    {
        public ParkingDbContext(DbContextOptions<ParkingDbContext> options) : base(options)
        {
        }

        public DbSet<ParkingSpace> ParkingSpaces { get; set; } = null!;
        public DbSet<Ticket> Tickets { get; set; } = null!;
        public DbSet<Tariff> Tariffs { get; set; } = null!;
        public DbSet<MonthlySubscriber> MonthlySubscribers { get; set; } = null!;
        public DbSet<User> Users { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure Decimal precision for financial fields
            modelBuilder.Entity<Tariff>()
                .Property(t => t.FirstHourRate)
                .HasPrecision(18, 2);

            modelBuilder.Entity<Tariff>()
                .Property(t => t.AdditionalHourRate)
                .HasPrecision(18, 2);

            modelBuilder.Entity<Tariff>()
                .Property(t => t.DailyMaxRate)
                .HasPrecision(18, 2);

            modelBuilder.Entity<Ticket>()
                .Property(t => t.AmountPaid)
                .HasPrecision(18, 2);

            modelBuilder.Entity<MonthlySubscriber>()
                .Property(m => m.MonthlyFee)
                .HasPrecision(18, 2);

            // Seed default Tariffs
            modelBuilder.Entity<Tariff>().HasData(
                new Tariff { Id = 1, VehicleType = VehicleType.Car, FirstHourRate = 10.00m, AdditionalHourRate = 5.00m, ToleranceMinutes = 15, DailyMaxRate = 60.00m },
                new Tariff { Id = 2, VehicleType = VehicleType.Motorcycle, FirstHourRate = 5.00m, AdditionalHourRate = 2.50m, ToleranceMinutes = 15, DailyMaxRate = 30.00m },
                new Tariff { Id = 3, VehicleType = VehicleType.Truck, FirstHourRate = 20.00m, AdditionalHourRate = 10.00m, ToleranceMinutes = 15, DailyMaxRate = 120.00m }
            );

            // Seed Parking Spaces
            var spaces = new List<ParkingSpace>();
            int idCounter = 1;

            // 10 Car spaces (A-01 to A-10)
            for (int i = 1; i <= 10; i++)
            {
                spaces.Add(new ParkingSpace { Id = idCounter++, Code = $"A-{i:D2}", AllowedType = VehicleType.Car, IsOccupied = false });
            }

            // 10 Motorcycle spaces (B-01 to B-10)
            for (int i = 1; i <= 10; i++)
            {
                spaces.Add(new ParkingSpace { Id = idCounter++, Code = $"B-{i:D2}", AllowedType = VehicleType.Motorcycle, IsOccupied = false });
            }

            // 5 Truck spaces (C-01 to C-05)
            for (int i = 1; i <= 5; i++)
            {
                spaces.Add(new ParkingSpace { Id = idCounter++, Code = $"C-{i:D2}", AllowedType = VehicleType.Truck, IsOccupied = false });
            }

            modelBuilder.Entity<ParkingSpace>().HasData(spaces);

            // Seed default Monthly Subscribers
            modelBuilder.Entity<MonthlySubscriber>().HasData(
                new MonthlySubscriber 
                { 
                    Id = 1, 
                    Name = "João Silva", 
                    CPF = "123.456.789-00", 
                    Plate = "MEN-1010", 
                    VehicleType = VehicleType.Car, 
                    Brand = "Chevrolet", 
                    Model = "Onix", 
                    Color = "Preto", 
                    MonthlyFee = 150.00m, 
                    StartDate = new DateTime(2026, 05, 01), 
                    EndDate = new DateTime(2026, 07, 01), 
                    IsActive = true 
                },
                new MonthlySubscriber 
                { 
                    Id = 2, 
                    Name = "Maria Oliveira", 
                    CPF = "987.654.321-11", 
                    Plate = "MEN-2020", 
                    VehicleType = VehicleType.Motorcycle, 
                    Brand = "Honda", 
                    Model = "CB 500", 
                    Color = "Azul", 
                    MonthlyFee = 80.00m, 
                    StartDate = new DateTime(2026, 05, 01), 
                    EndDate = new DateTime(2026, 07, 01), 
                    IsActive = true 
                }
            );

            // Seed default Users (hashed password hashes precalculated)
            modelBuilder.Entity<User>().HasData(
                new User
                {
                    Id = 1,
                    Username = "admin",
                    PasswordHash = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", // SHA256 of "admin"
                    Name = "Administrador Geral",
                    Role = "Admin"
                },
                new User
                {
                    Id = 2,
                    Username = "caixa",
                    PasswordHash = "e3d7b71d78b2fcdf81575b07832bd28ac63949df11aa6f55dbba726333b77780", // SHA256 of "caixa"
                    Name = "Operador de Caixa",
                    Role = "Cashier"
                }
            );
        }
    }
}
