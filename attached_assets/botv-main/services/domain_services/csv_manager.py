"""
CSV Manager Service - Base utility for CSV file operations
Handles reading/writing all CSV files
"""

import csv
import os
from typing import List, Dict, Any, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class CSVManager:
    """Centralized CSV file management"""
    
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        Path(data_dir).mkdir(exist_ok=True)
    
    def get_filepath(self, filename: str) -> str:
        """Get full path for CSV file"""
        return os.path.join(self.data_dir, f"{filename}.csv")
    
    def file_exists(self, filename: str) -> bool:
        """Check if CSV file exists"""
        return os.path.exists(self.get_filepath(filename))
    
    def create_file(self, filename: str, headers: List[str]) -> None:
        """Create new CSV file with headers"""
        filepath = self.get_filepath(filename)
        if not os.path.exists(filepath):
            with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                writer.writerow(headers)
            logger.info(f"Created CSV file: {filename}")
    
    def read_all(self, filename: str) -> List[Dict[str, str]]:
        """Read all rows from CSV file"""
        filepath = self.get_filepath(filename)
        if not os.path.exists(filepath):
            logger.warning(f"CSV file not found: {filename}")
            return []
        
        try:
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                return list(reader) if reader else []
        except Exception as e:
            logger.error(f"Error reading CSV {filename}: {e}")
            return []
    
    def read_by_id(self, filename: str, id_value: str, id_column: str = "id") -> Optional[Dict[str, str]]:
        """Read single row by ID"""
        rows = self.read_all(filename)
        for row in rows:
            if row.get(id_column) == id_value:
                return row
        return None
    
    def read_by_column(self, filename: str, column: str, value: str) -> List[Dict[str, str]]:
        """Read rows matching column value"""
        rows = self.read_all(filename)
        return [row for row in rows if row.get(column) == value]
    
    def write_row(self, filename: str, headers: List[str], row: List[str]) -> bool:
        """Append row to CSV file"""
        filepath = self.get_filepath(filename)
        try:
            # Create file if not exists
            if not os.path.exists(filepath):
                self.create_file(filename, headers)
            
            with open(filepath, 'a', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                writer.writerow(row)
            return True
        except Exception as e:
            logger.error(f"Error writing to CSV {filename}: {e}")
            return False
    
    def update_row(self, filename: str, id_value: str, updated_data: Dict[str, str], id_column: str = "id") -> bool:
        """Update row by ID"""
        filepath = self.get_filepath(filename)
        if not os.path.exists(filepath):
            logger.warning(f"CSV file not found: {filename}")
            return False
        
        try:
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                headers = reader.fieldnames
                rows = list(reader)
            
            # Find and update row
            found = False
            for row in rows:
                if row.get(id_column) == id_value:
                    row.update(updated_data)
                    found = True
                    break
            
            if not found:
                logger.warning(f"Row not found: {filename} with {id_column}={id_value}")
                return False
            
            # Write back
            with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.DictWriter(f, fieldnames=headers)
                writer.writeheader()
                writer.writerows(rows)
            
            return True
        except Exception as e:
            logger.error(f"Error updating CSV {filename}: {e}")
            return False
    
    def delete_row(self, filename: str, id_value: str, id_column: str = "id") -> bool:
        """Delete row by ID"""
        filepath = self.get_filepath(filename)
        if not os.path.exists(filepath):
            return False
        
        try:
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                headers = reader.fieldnames
                rows = list(reader)
            
            rows = [row for row in rows if row.get(id_column) != id_value]
            
            with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.DictWriter(f, fieldnames=headers)
                writer.writeheader()
                writer.writerows(rows)
            
            return True
        except Exception as e:
            logger.error(f"Error deleting from CSV {filename}: {e}")
            return False
    
    def backup(self, filename: str) -> bool:
        """Backup CSV file"""
        from datetime import datetime
        filepath = self.get_filepath(filename)
        if not os.path.exists(filepath):
            return False
        
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = f"{filepath}.backup.{timestamp}"
            with open(filepath, 'r', encoding='utf-8-sig') as src:
                with open(backup_path, 'w', encoding='utf-8-sig') as dst:
                    dst.write(src.read())
            logger.info(f"Backed up {filename} to {backup_path}")
            return True
        except Exception as e:
            logger.error(f"Error backing up {filename}: {e}")
            return False


# Global instance
csv_manager = CSVManager("data")
