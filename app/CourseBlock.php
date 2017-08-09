<?php

namespace App;

class CourseBlock extends Model
{
    public $timestamps = false;
    protected $table = 'course_blocks';

    public function courses()
    {
        return $this->hasMany(Course::class)
            ->orderBy('ordering');
    }

    public function getName()
    {
        return preg_replace('/\s*#\d+$/', '', $this->name);
    }

    public function getPaddedID()
    {
        return str_pad($this->id, 6, '_', STR_PAD_LEFT);
    }
}
