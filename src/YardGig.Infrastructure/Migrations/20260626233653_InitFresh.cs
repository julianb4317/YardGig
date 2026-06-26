using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace YardGig.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitFresh : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RecurringJobSeries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateJobId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignedVendorProfileId = table.Column<Guid>(type: "uuid", nullable: true),
                    Frequency = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Days = table.Column<List<string>>(type: "text[]", nullable: false),
                    Time = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    NextOccurrence = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    LastSpawnedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    TotalOccurrences = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecurringJobSeries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RecurringJobSeries_CustomerProfiles_CustomerProfileId",
                        column: x => x.CustomerProfileId,
                        principalTable: "CustomerProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RecurringJobSeries_JobRequests_TemplateJobId",
                        column: x => x.TemplateJobId,
                        principalTable: "JobRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RecurringJobSeries_VendorProfiles_AssignedVendorProfileId",
                        column: x => x.AssignedVendorProfileId,
                        principalTable: "VendorProfiles",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "idx_recurring_status_next",
                table: "RecurringJobSeries",
                columns: new[] { "Status", "NextOccurrence" });

            migrationBuilder.CreateIndex(
                name: "IX_RecurringJobSeries_AssignedVendorProfileId",
                table: "RecurringJobSeries",
                column: "AssignedVendorProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_RecurringJobSeries_CustomerProfileId",
                table: "RecurringJobSeries",
                column: "CustomerProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_RecurringJobSeries_TemplateJobId",
                table: "RecurringJobSeries",
                column: "TemplateJobId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RecurringJobSeries");
        }
    }
}
