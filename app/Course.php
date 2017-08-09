<?php

namespace App;

class Course extends Model
{
    public $timestamps = false;
    protected $table = 'courses';

    public function prerequisites()
    {
        return $this->belongsToMany(
            self::class,
            'prerequisites',
            'course_id',
            'prerequisite_course_id'
        )
        ->withPivot('is_parallel');
    }

    public function courseBlockReferences()
    {
        return $this->belongsToMany(
            CourseBlock::class,
            'course_reference_course_block'
        );
    }

    public function getPaddedID()
    {
        if (preg_match('/^___\d+___$/', $this->code)) {
            return $this->code;
        }

        return str_pad($this->id, 6, '0', STR_PAD_LEFT);
    }

    public function getTitle()
    {
        if (! $this->courseBlockReferences->isEmpty()) {
            return;
        }

        $title = $this->credits.' kredit';

        if ($this->code && ! preg_match('/^___.*___$/', $this->code)) {
            $title .= ' - '.$this->code;
        }

        if (! $this->prerequisites->isEmpty()) {
            $title .= '<hr>';
        }

        foreach ($this->prerequisites as $i => $prerequisite) {
            if ($i) {
                $title .= '<br>';
            }

            $title .= '• '.$prerequisite->name;

            if ($prerequisite->pivot->is_parallel) {
                $title .= ' <u>felvétele</u>';
            }
        }

        return $title;
    }

    public function getPrerequisitesIDs()
    {
        $prerequisitesIDs = [];

        foreach ($this->prerequisites as $prerequisite) {
            $prerequisitesIDs[] = ($prerequisite->pivot->is_parallel ? '#' : '').$prerequisite->getPaddedID();
        }

        return $prerequisitesIDs;
    }

    public function getCourseBlockReferencesIDs()
    {
        $courseBlockReferencesIDs = [];

        foreach ($this->courseBlockReferences as $courseBlockReference) {
            $courseBlockReferencesIDs[] = $courseBlockReference->getPaddedID();
        }

        return $courseBlockReferencesIDs;
    }
}
