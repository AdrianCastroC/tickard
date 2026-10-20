<?php

namespace Tests\Feature;

use App\Support\ProjectFileStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class OfficeUploadSecurityTest extends TestCase
{
    private function createArchive(string $filename, array $entries): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'tickard_office_');
        $zip = new \ZipArchive();
        $this->assertTrue($zip->open($path, \ZipArchive::OVERWRITE) === true);
        foreach ($entries as $name => $contents) {
            $this->assertTrue($zip->addFromString($name, $contents));
        }
        $this->assertTrue($zip->close());

        return new UploadedFile($path, $filename, null, null, true);
    }

    public function test_structurally_named_docx_and_xlsx_are_accepted(): void
    {
        if (! class_exists(\ZipArchive::class)) {
            $this->markTestSkipped('La validación Office requiere ext-zip.');
        }

        foreach ([
            'document.docx' => 'word/document.xml',
            'sheet.xlsx' => 'xl/workbook.xml',
        ] as $name => $required) {
            $file = $this->createArchive($name, [
                '[Content_Types].xml' => '<Types/>',
                $required => '<document/>',
            ]);
            try {
                ProjectFileStorage::validateUpload($file);
                $this->assertTrue(true);
            } finally {
                @unlink($file->getRealPath());
            }
        }
    }

    public function test_office_archives_with_parent_directory_entry_are_rejected(): void
    {
        if (! class_exists(\ZipArchive::class)) {
            $this->markTestSkipped('La validación Office requiere ext-zip.');
        }

        $file = $this->createArchive('document.docx', [
            '[Content_Types].xml' => '<Types/>',
            'word/document.xml' => '<document/>',
            '../escaping.txt' => 'hidden',
        ]);
        try {
            $this->expectException(ValidationException::class);
            ProjectFileStorage::validateUpload($file);
        } finally {
            @unlink($file->getRealPath());
        }
    }

    public function test_wrong_office_archive_structure_is_rejected(): void
    {
        if (! class_exists(\ZipArchive::class)) {
            $this->markTestSkipped('La validación Office requiere ext-zip.');
        }

        $file = $this->createArchive('document.docx', [
            '[Content_Types].xml' => '<Types/>',
            'xl/workbook.xml' => '<worksheet/>',
        ]);
        try {
            $this->expectException(ValidationException::class);
            ProjectFileStorage::validateUpload($file);
        } finally {
            @unlink($file->getRealPath());
        }
    }
}
