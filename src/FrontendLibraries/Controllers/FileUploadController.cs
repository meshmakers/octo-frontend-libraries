using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;

namespace FrontendLibraries.Controllers;

[ApiController]
[Route("[controller]")]
public class FileUploadController(ILogger<FileUploadController> logger) : ControllerBase
{
    private static readonly string[] Summaries =
    [
        "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
    ];

    
    [HttpGet]
    public IEnumerable<WeatherForecast> Get()
    {
        return Enumerable.Range(1, 5).Select(index => new WeatherForecast
            {
                Date = DateTime.Now.AddDays(index),
                TemperatureC = Random.Shared.Next(-20, 55),
                Summary = Summaries[Random.Shared.Next(Summaries.Length)]
            })
            .ToArray();
    }
    
    
    // POST: system/Models/ImportRt
    /// <summary>
    ///     Imports a runtime model
    /// </summary>
    /// <param name="tenantId">ID of tenant the request relies on to</param>
    /// <param name="file">The file with the RT model definition</param>
    /// <returns></returns>
    [HttpPost]
    [RequestSizeLimit(300_000_000)]
    [Route("Upload")]
    public async Task<IActionResult> Upload([Required] string tenantId, [FromForm] IFormFile file)
    {
        logger.LogInformation("Upload started");
        try
        {
            string fileName = Path.GetTempFileName();
            await using var fileStream = System.IO.File.OpenWrite(fileName);
            await file.CopyToAsync(fileStream);
            //return BadRequest("this is my error message");
            return Ok();
        }
        catch (InvalidOperationException e)
        {
            return BadRequest(e.Message);
        }
    }
    
    // POST: system/Models/ImportRt
    /// <summary>
    ///     Imports a runtime model
    /// </summary>
    /// <param name="tenantId">ID of tenant the request relies on to</param>
    /// <returns></returns>
    [HttpPost]
    [RequestSizeLimit(300_000_000)]
    [Route("test2")]
    public IActionResult Upload([Required] string tenantId)
    {
        logger.LogInformation("Upload started");
        try
        {
            return Ok();
        }
        catch (InvalidOperationException e)
        {
            return BadRequest(e.Message);
        }
    }
}