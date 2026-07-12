import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class CallLogDatabaseHelper {
  static final CallLogDatabaseHelper _instance = CallLogDatabaseHelper._internal();
  factory CallLogDatabaseHelper() => _instance;
  CallLogDatabaseHelper._internal();

  Database? _db;

  Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _initDb();
    return _db!;
  }

  Future<Database> _initDb() async {
    final databasesPath = await getDatabasesPath();
    final path = join(databasesPath, 'call_log_sync.db');
    return await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE pending_sync (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone_number TEXT,
            call_type TEXT,
            duration_seconds INTEGER,
            timestamp TEXT,
            synced INTEGER DEFAULT 0,
            UNIQUE(phone_number, timestamp) ON CONFLICT IGNORE
          )
        ''');
      },
    );
  }

  Future<void> insertPendingSync(Map<String, dynamic> log) async {
    try {
      final db = await database;
      await db.insert(
        'pending_sync',
        {
          'phone_number': log['phoneNumber'],
          'call_type': log['callType'],
          'duration_seconds': log['durationSeconds'],
          'timestamp': log['timestamp'],
          'synced': 0,
        },
        conflictAlgorithm: ConflictAlgorithm.ignore,
      );
    } catch (e) {
      print('[DB] Error inserting call log: $e');
    }
  }

  Future<List<Map<String, dynamic>>> getUnsyncedLogs() async {
    try {
      final db = await database;
      final List<Map<String, dynamic>> maps = await db.query(
        'pending_sync',
        where: 'synced = 0',
      );
      return maps.map((m) {
        return {
          'id': m['id'],
          'phoneNumber': m['phone_number'],
          'callType': m['call_type'],
          'durationSeconds': m['duration_seconds'],
          'timestamp': m['timestamp'],
        };
      }).toList();
    } catch (e) {
      print('[DB] Error fetching unsynced logs: $e');
      return [];
    }
  }

  Future<void> markAsSynced(List<int> ids) async {
    if (ids.isEmpty) return;
    try {
      final db = await database;
      final batch = db.batch();
      for (final id in ids) {
        batch.update(
          'pending_sync',
          {'synced': 1},
          where: 'id = ?',
          whereArgs: [id],
        );
      }
      await batch.commit(noResult: true);
    } catch (e) {
      print('[DB] Error marking logs as synced: $e');
    }
  }

  Future<void> cleanOldLogs() async {
    try {
      final db = await database;
      final thirtyDaysAgo = DateTime.now().subtract(const Duration(days: 30)).toUtc().toIso8601String();
      await db.delete(
        'pending_sync',
        where: 'synced = 1 AND timestamp < ?',
        whereArgs: [thirtyDaysAgo],
      );
    } catch (e) {
      print('[DB] Error pruning old call logs: $e');
    }
  }
}
