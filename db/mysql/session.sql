CREATE TABLE `session` (
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

