# Estágio de Compilação
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copia o arquivo .csproj e restaura as dependências
COPY ["ParkingSystem.csproj", "./"]
RUN dotnet restore "ParkingSystem.csproj"

# Copia todos os arquivos restantes e compila o projeto
COPY . .
RUN dotnet build "ParkingSystem.csproj" -c Release -o /app/build

# Estágio de Publicação
FROM build AS publish
RUN dotnet publish "ParkingSystem.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Estágio Final / Runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Cria a pasta dedicada para o banco de dados SQLite persistente
RUN mkdir -p /app/data

# Configura variáveis de ambiente padrão para o ASP.NET Core
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "ParkingSystem.dll"]
