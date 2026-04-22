CREATE TABLE `activityLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`entityType` enum('user','client','site','project','contract','intervention','technician','document') NOT NULL,
	`entityId` int NOT NULL,
	`action` varchar(120) NOT NULL,
	`message` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activityLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clientContacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`userId` int,
	`firstName` varchar(120) NOT NULL,
	`lastName` varchar(120) NOT NULL,
	`email` varchar(320),
	`phone` varchar(32),
	`jobTitle` varchar(160),
	`contactType` enum('principal','technique','facturation','autre') NOT NULL DEFAULT 'principal',
	`isPrimary` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clientContacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_contacts_user_unique_idx` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerType` enum('particulier','professionnel','collectivite') NOT NULL DEFAULT 'professionnel',
	`companyName` varchar(255) NOT NULL,
	`legalName` varchar(255),
	`email` varchar(320),
	`phone` varchar(32),
	`billingAddress` text,
	`postalCode` varchar(20),
	`city` varchar(120),
	`country` varchar(120) NOT NULL DEFAULT 'France',
	`notes` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('user','client','site','project','contract','intervention','technician','document') NOT NULL,
	`entityId` int NOT NULL,
	`clientId` int,
	`siteId` int,
	`projectId` int,
	`contractId` int,
	`interventionId` int,
	`uploadedByUserId` int,
	`title` varchar(255) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(1024) NOT NULL,
	`mimeType` varchar(160),
	`documentType` enum('rapport','photo','contrat','bon_intervention','plan','autre') NOT NULL DEFAULT 'autre',
	`documentVisibility` enum('interne','client','restreint') NOT NULL DEFAULT 'interne',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interventions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(64) NOT NULL,
	`clientId` int NOT NULL,
	`siteId` int,
	`projectId` int,
	`contractId` int,
	`technicianId` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`interventionType` enum('installation','maintenance','depannage','inspection','urgence','autre') NOT NULL DEFAULT 'maintenance',
	`interventionPriority` enum('basse','normale','haute','urgente') NOT NULL DEFAULT 'normale',
	`interventionStatus` enum('planifiee','assignee','en_cours','rapport_a_faire','terminee','annulee') NOT NULL DEFAULT 'planifiee',
	`scheduledStartAt` datetime,
	`scheduledEndAt` datetime,
	`startedAt` datetime,
	`completedAt` datetime,
	`report` text,
	`internalNotes` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `interventions_id` PRIMARY KEY(`id`),
	CONSTRAINT `interventions_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `maintenanceContracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractNumber` varchar(64) NOT NULL,
	`clientId` int NOT NULL,
	`siteId` int,
	`title` varchar(255) NOT NULL,
	`serviceType` enum('clim','pac','chauffe_eau','pv','vmc','autre') NOT NULL DEFAULT 'autre',
	`contractFrequency` enum('mensuelle','trimestrielle','semestrielle','annuelle','personnalisee') NOT NULL DEFAULT 'annuelle',
	`contractStatus` enum('brouillon','actif','renouvellement_proche','expire','suspendu') NOT NULL DEFAULT 'brouillon',
	`annualAmount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`renewalNoticeDays` int NOT NULL DEFAULT 30,
	`startDate` date,
	`nextServiceDate` date,
	`endDate` date,
	`notes` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maintenanceContracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `maintenanceContracts_contractNumber_unique` UNIQUE(`contractNumber`)
);
--> statement-breakpoint
CREATE TABLE `projectAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`technicianId` int NOT NULL,
	`assignmentRole` enum('chef_equipe','technicien','renfort') NOT NULL DEFAULT 'technicien',
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	`assignedByUserId` int,
	CONSTRAINT `projectAssignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(64) NOT NULL,
	`clientId` int NOT NULL,
	`siteId` int,
	`title` varchar(255) NOT NULL,
	`serviceType` enum('clim','pac','chauffe_eau','pv','vmc','autre') NOT NULL DEFAULT 'autre',
	`description` text,
	`projectStatus` enum('brouillon','planifie','en_cours','bloque','termine','annule') NOT NULL DEFAULT 'brouillon',
	`progressPercent` int NOT NULL DEFAULT 0,
	`estimatedHours` decimal(8,2) NOT NULL DEFAULT '0.00',
	`actualHours` decimal(8,2) NOT NULL DEFAULT '0.00',
	`budgetAmount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`startDate` date,
	`plannedEndDate` date,
	`actualEndDate` date,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `sites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`siteCode` varchar(64),
	`siteName` varchar(255) NOT NULL,
	`addressLine1` text NOT NULL,
	`addressLine2` text,
	`postalCode` varchar(20),
	`city` varchar(120) NOT NULL,
	`country` varchar(120) NOT NULL DEFAULT 'France',
	`latitude` double,
	`longitude` double,
	`accessInstructions` text,
	`notes` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `technicianAvailability` (
	`id` int AUTO_INCREMENT NOT NULL,
	`technicianId` int NOT NULL,
	`availabilityType` enum('disponible','indisponible','conges','formation','maladie') NOT NULL DEFAULT 'disponible',
	`startAt` datetime NOT NULL,
	`endAt` datetime NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `technicianAvailability_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `technicians` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`firstName` varchar(120) NOT NULL,
	`lastName` varchar(120) NOT NULL,
	`email` varchar(320),
	`phone` varchar(32),
	`employeeCode` varchar(64),
	`skills` json,
	`notes` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `technicians_id` PRIMARY KEY(`id`),
	CONSTRAINT `technicians_user_unique_idx` UNIQUE(`userId`),
	CONSTRAINT `technicians_employee_code_idx` UNIQUE(`employeeCode`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','technicien','client') NOT NULL DEFAULT 'client';--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `accountStatus` enum('active','invited','suspended') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `activityLogs` ADD CONSTRAINT `activityLogs_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clientContacts` ADD CONSTRAINT `clientContacts_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clientContacts` ADD CONSTRAINT `clientContacts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_siteId_sites_id_fk` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_contractId_maintenanceContracts_id_fk` FOREIGN KEY (`contractId`) REFERENCES `maintenanceContracts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_interventionId_interventions_id_fk` FOREIGN KEY (`interventionId`) REFERENCES `interventions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_uploadedByUserId_users_id_fk` FOREIGN KEY (`uploadedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interventions` ADD CONSTRAINT `interventions_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interventions` ADD CONSTRAINT `interventions_siteId_sites_id_fk` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interventions` ADD CONSTRAINT `interventions_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interventions` ADD CONSTRAINT `interventions_contractId_maintenanceContracts_id_fk` FOREIGN KEY (`contractId`) REFERENCES `maintenanceContracts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interventions` ADD CONSTRAINT `interventions_technicianId_technicians_id_fk` FOREIGN KEY (`technicianId`) REFERENCES `technicians`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interventions` ADD CONSTRAINT `interventions_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenanceContracts` ADD CONSTRAINT `maintenanceContracts_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenanceContracts` ADD CONSTRAINT `maintenanceContracts_siteId_sites_id_fk` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenanceContracts` ADD CONSTRAINT `maintenanceContracts_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectAssignments` ADD CONSTRAINT `projectAssignments_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectAssignments` ADD CONSTRAINT `projectAssignments_technicianId_technicians_id_fk` FOREIGN KEY (`technicianId`) REFERENCES `technicians`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectAssignments` ADD CONSTRAINT `projectAssignments_assignedByUserId_users_id_fk` FOREIGN KEY (`assignedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_siteId_sites_id_fk` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sites` ADD CONSTRAINT `sites_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `technicianAvailability` ADD CONSTRAINT `technicianAvailability_technicianId_technicians_id_fk` FOREIGN KEY (`technicianId`) REFERENCES `technicians`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `technicians` ADD CONSTRAINT `technicians_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `activity_logs_entity_idx` ON `activityLogs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `activity_logs_actor_idx` ON `activityLogs` (`actorUserId`);--> statement-breakpoint
CREATE INDEX `client_contacts_client_idx` ON `clientContacts` (`clientId`);--> statement-breakpoint
CREATE INDEX `clients_company_idx` ON `clients` (`companyName`);--> statement-breakpoint
CREATE INDEX `documents_entity_idx` ON `documents` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `documents_project_idx` ON `documents` (`projectId`);--> statement-breakpoint
CREATE INDEX `documents_contract_idx` ON `documents` (`contractId`);--> statement-breakpoint
CREATE INDEX `documents_intervention_idx` ON `documents` (`interventionId`);--> statement-breakpoint
CREATE INDEX `interventions_client_idx` ON `interventions` (`clientId`);--> statement-breakpoint
CREATE INDEX `interventions_site_idx` ON `interventions` (`siteId`);--> statement-breakpoint
CREATE INDEX `interventions_project_idx` ON `interventions` (`projectId`);--> statement-breakpoint
CREATE INDEX `interventions_contract_idx` ON `interventions` (`contractId`);--> statement-breakpoint
CREATE INDEX `interventions_technician_idx` ON `interventions` (`technicianId`);--> statement-breakpoint
CREATE INDEX `interventions_status_idx` ON `interventions` (`interventionStatus`);--> statement-breakpoint
CREATE INDEX `interventions_schedule_idx` ON `interventions` (`scheduledStartAt`);--> statement-breakpoint
CREATE INDEX `contracts_client_idx` ON `maintenanceContracts` (`clientId`);--> statement-breakpoint
CREATE INDEX `contracts_site_idx` ON `maintenanceContracts` (`siteId`);--> statement-breakpoint
CREATE INDEX `contracts_status_idx` ON `maintenanceContracts` (`contractStatus`);--> statement-breakpoint
CREATE INDEX `contracts_next_service_idx` ON `maintenanceContracts` (`nextServiceDate`);--> statement-breakpoint
CREATE INDEX `project_assignments_project_idx` ON `projectAssignments` (`projectId`);--> statement-breakpoint
CREATE INDEX `project_assignments_technician_idx` ON `projectAssignments` (`technicianId`);--> statement-breakpoint
CREATE INDEX `projects_client_idx` ON `projects` (`clientId`);--> statement-breakpoint
CREATE INDEX `projects_site_idx` ON `projects` (`siteId`);--> statement-breakpoint
CREATE INDEX `projects_status_idx` ON `projects` (`projectStatus`);--> statement-breakpoint
CREATE INDEX `sites_client_idx` ON `sites` (`clientId`);--> statement-breakpoint
CREATE INDEX `sites_site_code_idx` ON `sites` (`siteCode`);--> statement-breakpoint
CREATE INDEX `technician_availability_technician_idx` ON `technicianAvailability` (`technicianId`);--> statement-breakpoint
CREATE INDEX `technician_availability_start_idx` ON `technicianAvailability` (`startAt`);--> statement-breakpoint
CREATE INDEX `technicians_active_idx` ON `technicians` (`isActive`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `users_status_idx` ON `users` (`accountStatus`);