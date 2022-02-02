CREATE TABLE `auth` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `collection` varchar(64) NOT NULL,
  `partner` int(11) NOT NULL DEFAULT '0',
  `user` int(11) NOT NULL DEFAULT '0',
  `access` int(11) NOT NULL DEFAULT '0',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `v0` varchar(256) DEFAULT NULL,
  `v1` varchar(256) DEFAULT NULL,
  `v2` varchar(256) DEFAULT NULL,
  `v3` varchar(256) DEFAULT NULL,
  `v4` varchar(256) DEFAULT NULL,
  `v5` varchar(256) DEFAULT NULL,
  `v6` varchar(256) DEFAULT NULL,
  `v7` varchar(256) DEFAULT NULL,
  `v8` varchar(256) DEFAULT NULL,
  `v9` varchar(256) DEFAULT NULL,
  `v10` varchar(256) DEFAULT NULL,
  `v11` varchar(256) DEFAULT NULL,
  `v12` varchar(256) DEFAULT NULL,
  `v13` varchar(256) DEFAULT NULL,
  `v14` varchar(256) DEFAULT NULL,
  `v15` varchar(256) DEFAULT NULL,
  `v16` varchar(256) DEFAULT NULL,
  `v17` varchar(256) DEFAULT NULL,
  `v18` varchar(256) DEFAULT NULL,
  `v19` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;


INSERT INTO `auth` (`id`,`collection`,`create_time`,`partner`,`user`,`access`,`active`,`v0`,`v1`,`v2`,`v3`,`v4`,`v5`,`v6`,`v7`,`v8`,`v9`,`v10`,`v11`,`v12`,`v13`,`v14`,`v15`,`v16`,`v17`,`v18`,`v19`) 
VALUES (1,'partner-fields','2018-01-31 15:03:57',0,0,777,1,'name','type','cellphone','email','vat_no','tel_no','country','postal_address','postal_code','company_registration_no','start_page','acc_no',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO `auth` (`id`,`collection`,`create_time`,`partner`,`user`,`access`,`active`,`v0`,`v1`,`v2`,`v3`,`v4`,`v5`,`v6`,`v7`,`v8`,`v9`,`v10`,`v11`,`v12`,`v13`,`v14`,`v15`,`v16`,`v17`,`v18`,`v19`) 
VALUES (2,'partner','2018-01-31 15:03:58',0,0,777,1,'Mukoni Software','developer','+27828992177','info@mukoni.co.za','1245981576','0129499594','za','P O Box 1922 Cape Town','8000','12545454121454545',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO `auth` (`id`,`collection`,`create_time`,`partner`,`user`,`access`,`active`,`v0`,`v1`,`v2`,`v3`,`v4`,`v5`,`v6`,`v7`,`v8`,`v9`,`v10`,`v11`,`v12`,`v13`,`v14`,`v15`,`v16`,`v17`,`v18`,`v19`) 
VALUES (3,'user-fields','2018-01-31 15:03:58',0,0,777,1,'email','password','attempts','title','first_name','last_name','cellphone','role','time_added','country','user_group',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO `auth` (`id`,`collection`,`create_time`,`partner`,`user`,`access`,`active`,`v0`,`v1`,`v2`,`v3`,`v4`,`v5`,`v6`,`v7`,`v8`,`v9`,`v10`,`v11`,`v12`,`v13`,`v14`,`v15`,`v16`,`v17`,`v18`,`v19`) 
VALUES (4,'user','2018-09-26 10:23:35',2,4,777,1,'user@didingwe.net','*42434304F38173D0FC396F60C077C662FE6EE7DD','0','ms','Sample','User','0123456789','reg','2018-09-26 10:23:35','','',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO `auth` (`id`,`collection`,`partner`,`user`,`access`,`active`,`create_time`,`v0`,`v1`,`v2`,`v3`,`v4`,`v5`,`v6`,`v7`,`v8`,`v9`,`v10`,`v11`,`v12`,`v13`,`v14`,`v15`,`v16`,`v17`,`v18`,`v19`) 
VALUES (5,'role-fields',0,0,777,1,'2018-01-19 02:42:43','id','name','includes',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO `auth` (`id`,`collection`,`partner`,`user`,`access`,`active`,`create_time`,`v0`,`v1`,`v2`,`v3`,`v4`,`v5`,`v6`,`v7`,`v8`,`v9`,`v10`,`v11`,`v12`,`v13`,`v14`,`v15`,`v16`,`v17`,`v18`,`v19`) 
VALUES (6,'role',0,0,777,1,'2018-01-19 02:42:43','admin','Administrator','user',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO `auth` (`id`,`collection`,`partner`,`user`,`access`,`active`,`create_time`,`v0`,`v1`,`v2`,`v3`,`v4`,`v5`,`v6`,`v7`,`v8`,`v9`,`v10`,`v11`,`v12`,`v13`,`v14`,`v15`,`v16`,`v17`,`v18`,`v19`) 
VALUES (7,'role',0,0,777,1,'2018-01-19 02:42:43','finance','Finance','user',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO `auth` (`id`,`collection`,`partner`,`user`,`access`,`active`,`create_time`,`v0`,`v1`,`v2`,`v3`,`v4`,`v5`,`v6`,`v7`,`v8`,`v9`,`v10`,`v11`,`v12`,`v13`,`v14`,`v15`,`v16`,`v17`,`v18`,`v19`) 
VALUES (8,'role',0,0,777,1,'2018-01-19 02:42:43','registrant','Registrant',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO `auth` (`id`,`collection`,`partner`,`user`,`access`,`active`,`create_time`,`v0`,`v1`,`v2`,`v3`,`v4`,`v5`,`v6`,`v7`,`v8`,`v9`,`v10`,`v11`,`v12`,`v13`,`v14`,`v15`,`v16`,`v17`,`v18`,`v19`) 
VALUES (9,'role',0,0,777,1,'2018-01-19 02:42:43','sysadmin','System Administrator','user',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO `auth` (`id`,`collection`,`partner`,`user`,`access`,`active`,`create_time`,`v0`,`v1`,`v2`,`v3`,`v4`,`v5`,`v6`,`v7`,`v8`,`v9`,`v10`,`v11`,`v12`,`v13`,`v14`,`v15`,`v16`,`v17`,`v18`,`v19`)
VALUES (10,'role',0,0,777,1,'2018-01-19 02:42:43','user','User','viewer',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO `auth` (`id`,`collection`,`partner`,`user`,`access`,`active`,`create_time`,`v0`,`v1`,`v2`,`v3`,`v4`,`v5`,`v6`,`v7`,`v8`,`v9`,`v10`,`v11`,`v12`,`v13`,`v14`,`v15`,`v16`,`v17`,`v18`,`v19`) 
VALUES (11,'role',0,0,777,1,'2018-01-19 02:42:43','viewer','Viewer',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO `auth` (`id`,`collection`,`partner`,`user`,`access`,`active`,`create_time`,`v0`,`v1`,`v2`,`v3`,`v4`,`v5`,`v6`,`v7`,`v8`,`v9`,`v10`,`v11`,`v12`,`v13`,`v14`,`v15`,`v16`,`v17`,`v18`,`v19`) 
VALUES (12,'role',0,0,777,1,'2018-01-19 02:42:43','agent','Agent','user',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO `auth` (`id`,`collection`,`partner`,`user`,`access`,`active`,`create_time`,`v0`,`v1`,`v2`,`v3`,`v4`,`v5`,`v6`,`v7`,`v8`,`v9`,`v10`,`v11`,`v12`,`v13`,`v14`,`v15`,`v16`,`v17`,`v18`,`v19`) 
VALUES (13,'role',0,0,777,1,'2018-01-19 02:42:43','manager','Manager','user',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO `auth` (`id`,`collection`,`partner`,`user`,`access`,`active`,`create_time`,`v0`,`v1`,`v2`,`v3`,`v4`,`v5`,`v6`,`v7`,`v8`,`v9`,`v10`,`v11`,`v12`,`v13`,`v14`,`v15`,`v16`,`v17`,`v18`,`v19`) 
VALUES (14, 'role',0,0,777,1,'2018-01-19 02:42:43','clerk','Clerk','user',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
