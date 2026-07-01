using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Rakr.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FullSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "EstimatedHours",
                table: "JobRequests",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HourlyRateCents",
                table: "JobRequests",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "JobDetailsJson",
                table: "JobRequests",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MaxHours",
                table: "JobRequests",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OriginalBudgetCents",
                table: "JobRequests",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PricingType",
                table: "JobRequests",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "BudgetCents",
                table: "EscrowTransactions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "CapturedAt",
                table: "EscrowTransactions",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ProcessingFeeCents",
                table: "EscrowTransactions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TrustFeeCents",
                table: "EscrowTransactions",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EstimatedHours",
                table: "JobRequests");

            migrationBuilder.DropColumn(
                name: "HourlyRateCents",
                table: "JobRequests");

            migrationBuilder.DropColumn(
                name: "JobDetailsJson",
                table: "JobRequests");

            migrationBuilder.DropColumn(
                name: "MaxHours",
                table: "JobRequests");

            migrationBuilder.DropColumn(
                name: "OriginalBudgetCents",
                table: "JobRequests");

            migrationBuilder.DropColumn(
                name: "PricingType",
                table: "JobRequests");

            migrationBuilder.DropColumn(
                name: "BudgetCents",
                table: "EscrowTransactions");

            migrationBuilder.DropColumn(
                name: "CapturedAt",
                table: "EscrowTransactions");

            migrationBuilder.DropColumn(
                name: "ProcessingFeeCents",
                table: "EscrowTransactions");

            migrationBuilder.DropColumn(
                name: "TrustFeeCents",
                table: "EscrowTransactions");
        }
    }
}
